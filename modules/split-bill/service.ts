import { Prisma, SplitBillItemMethod, SplitBillStatus, WalletType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrCreatePayeeByName } from "@/modules/payee/service";

type ParticipantInput = { name: string; isMe: boolean };
type ItemInput = { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] };
type SplitBillInput = { merchantName: string; participants: ParticipantInput[]; items: ItemInput[]; note?: string };

function decimal(value: number) { return new Prisma.Decimal(value); }
function balanceDelta(type: "INCOME" | "EXPENSE", amount: Prisma.Decimal) { return type === "INCOME" ? amount : amount.negated(); }
async function applyBalanceDelta(tx: Prisma.TransactionClient, walletId: string, delta: Prisma.Decimal) {
  if (delta.isZero()) return;
  await tx.wallet.update({ where: { id: walletId }, data: { currentBalance: delta.isPositive() ? { increment: delta } : { decrement: delta.abs() } } });
}

function validateInput(input: SplitBillInput) {
  if (!input.merchantName.trim()) throw new Error("Merchant is required.");
  if (input.participants.length < 2) throw new Error("Add at least one friend to split the bill with you.");
  if (input.participants.filter((participant) => participant.isMe).length !== 1) throw new Error("Split Bill must have exactly one 'You' participant.");
  if (input.items.length === 0) throw new Error("Add at least one bill item.");
  if (input.participants.some((participant) => !participant.isMe && !participant.name.trim())) throw new Error("Every friend needs a name.");
  for (const item of input.items) {
    if (!item.name.trim() || item.quantity <= 0 || item.unitPrice < 0) throw new Error("Each item must have a name, positive quantity, and non-negative unit price.");
    if (item.splitMethod === "PRO_RATA" && item.units.every((unit) => Number(unit) <= 0)) throw new Error(`Set at least one share unit for '${item.name}'.`);
  }
}

export async function createSplitBill(input: SplitBillInput) {
  validateInput(input);
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.create({ data: { merchantName: input.merchantName.trim(), totalAmount: 0, personalAmount: 0, status: SplitBillStatus.DRAFT, note: input.note?.trim() || null } });
    const participants = await Promise.all(input.participants.map((participant) => tx.splitBillParticipant.create({ data: { splitBillId: splitBill.id, name: participant.isMe ? "You" : participant.name.trim(), isMe: participant.isMe } })));
    const shareTotals = participants.map(() => new Prisma.Decimal(0));
    let totalAmount = new Prisma.Decimal(0);

    for (const inputItem of input.items) {
      const itemAmount = decimal(inputItem.quantity).mul(decimal(inputItem.unitPrice));
      totalAmount = totalAmount.plus(itemAmount);
      const method = inputItem.splitMethod === "PRO_RATA" ? SplitBillItemMethod.PRO_RATA : SplitBillItemMethod.EQUAL;
      const units = method === SplitBillItemMethod.EQUAL ? participants.map(() => new Prisma.Decimal(1)) : participants.map((_, index) => decimal(inputItem.units[index] ?? 0));
      const unitTotal = units.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
      if (unitTotal.lte(0)) throw new Error(`Set at least one share unit for '${inputItem.name}'.`);
      const item = await tx.splitBillItem.create({ data: { splitBillId: splitBill.id, name: inputItem.name.trim(), quantity: inputItem.quantity, unitPrice: inputItem.unitPrice, splitMethod: method } });
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        if (units[participantIndex].lte(0)) continue;
        const amount = units[participantIndex].div(unitTotal).mul(itemAmount);
        shareTotals[participantIndex] = shareTotals[participantIndex].plus(amount);
        await tx.splitBillItemAllocation.create({ data: { itemId: item.id, participantId: participants[participantIndex].id, units: units[participantIndex], amount } });
      }
    }

    const personalIndex = input.participants.findIndex((participant) => participant.isMe);
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { totalAmount, personalAmount: shareTotals[personalIndex] } });
    for (let index = 0; index < participants.length; index += 1) await tx.splitBillParticipant.update({ where: { id: participants[index].id }, data: { shareAmount: shareTotals[index] } });
    return splitBill;
  });
}

export async function finalizeSplitBill(splitBillId: string, input: { transactionDate: Date; walletId: string }) {
  const payeeName = await prisma.splitBill.findUnique({ where: { id: splitBillId }, select: { merchantName: true } });
  if (!payeeName) throw new Error("Split Bill not found.");
  const payee = await findOrCreatePayeeByName(payeeName.merchantName);

  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.findUnique({ where: { id: splitBillId }, include: { participants: { include: { receivable: true } } } });
    if (!splitBill) throw new Error("Split Bill not found.");
    if (splitBill.status !== SplitBillStatus.DRAFT && splitBill.status !== SplitBillStatus.OPEN) throw new Error("This Split Bill has already been finalized or cancelled.");
    if (splitBill.transactionId) throw new Error("This Split Bill is already linked to a transaction.");
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, currencyId: true, walletType: true, balanceAsOf: true } });
    if (!wallet) throw new Error("Wallet not found.");

    const transaction = await tx.transaction.create({ data: { transactionDate: input.transactionDate, type: "EXPENSE", kind: "STANDARD", amount: splitBill.totalAmount, note: splitBill.note || `Split Bill: ${splitBill.merchantName}`, wallet: { connect: { id: wallet.id } }, payee: payee ? { connect: { id: payee.id } } : undefined } });
    if (!wallet.balanceAsOf || transaction.transactionDate > wallet.balanceAsOf || (transaction.transactionDate.toDateString() === wallet.balanceAsOf.toDateString() && transaction.createdAt > wallet.balanceAsOf)) await applyBalanceDelta(tx, wallet.id, balanceDelta("EXPENSE", splitBill.totalAmount));

    for (const participant of splitBill.participants) {
      if (participant.isMe || participant.shareAmount.lte(0)) continue;
      if (participant.receivable) continue;
      await tx.receivable.create({ data: { personName: participant.name, description: `Split Bill: ${splitBill.merchantName}`, amount: participant.shareAmount, currencyId: wallet.currencyId, sourceWalletId: wallet.id, loanDate: input.transactionDate, sourceTransactionId: transaction.id, splitBillParticipantId: participant.id } });
    }

    await tx.splitBill.update({ where: { id: splitBill.id }, data: { transactionId: transaction.id, status: SplitBillStatus.OPEN } });
    return transaction;
  });
}

export async function getSplitBills() {
  return prisma.splitBill.findMany({
    include: {
      transaction: { include: { wallet: { select: { name: true, walletType: true, currency: { select: { code: true, symbol: true } } } }, payee: { select: { name: true } }, category: { select: { name: true } } } },
      participants: { include: { receivable: { include: { payments: { select: { amount: true } } } } }, orderBy: { isMe: "desc" } },
      items: { include: { allocations: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteSplitBill(splitBillId: string) {
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.findUnique({ where: { id: splitBillId }, include: { participants: { include: { receivable: { include: { payments: true } } } } } });
    if (!splitBill) throw new Error("Split Bill not found.");
    const hasPayments = splitBill.participants.some((participant) => (participant.receivable?.payments.length ?? 0) > 0);
    if (hasPayments) throw new Error("Remove the receivable payment history before deleting this Split Bill.");
    const receivableIds = splitBill.participants.map((participant) => participant.receivable?.id).filter((id): id is string => Boolean(id));
    if (receivableIds.length) await tx.receivable.deleteMany({ where: { id: { in: receivableIds } } });
    await tx.splitBill.delete({ where: { id: splitBill.id } });
  });
}
