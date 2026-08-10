import { Prisma, SplitBillItemMethod, SplitBillStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ParticipantInput = { name: string; isMe: boolean };
type ItemInput = { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] };
type SplitBillInput = { transactionId: string; participants: ParticipantInput[]; items: ItemInput[]; note?: string };

function decimal(value: number) { return new Prisma.Decimal(value); }

export async function createSplitBill(input: SplitBillInput) {
  if (!input.transactionId) throw new Error("Transaction is required.");
  if (input.participants.length < 2) throw new Error("Add at least one friend to split the bill with you.");
  if (input.participants.filter((participant) => participant.isMe).length !== 1) throw new Error("Split Bill must have exactly one 'You' participant.");
  if (input.items.length === 0) throw new Error("Add at least one bill item.");
  if (input.participants.some((participant) => !participant.isMe && !participant.name.trim())) throw new Error("Every friend needs a name.");

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: input.transactionId },
      include: { wallet: { select: { id: true, currencyId: true } }, splitBill: { select: { id: true } } },
    });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.type !== "EXPENSE") throw new Error("Split Bill can only be created from an expense transaction.");
    if (transaction.splitBill) throw new Error("This transaction already has a Split Bill.");

    const transactionAmount = decimal(Number(transaction.amount));
    const itemTotal = input.items.reduce((sum, item) => sum.plus(decimal(item.quantity).mul(decimal(item.unitPrice))), new Prisma.Decimal(0));
    if (!itemTotal.eq(transactionAmount)) throw new Error(`Items total must equal the transaction amount (${transactionAmount.toString()}). Add tax, service charge, discount, or other lines as separate items if needed.`);

    for (const item of input.items) {
      if (!item.name.trim() || item.quantity <= 0 || item.unitPrice < 0) throw new Error("Each item must have a name, positive quantity, and non-negative unit price.");
      if (item.splitMethod === "PRO_RATA" && item.units.every((unit) => Number(unit) <= 0)) throw new Error(`Set at least one share unit for '${item.name}'.`);
    }

    const splitBill = await tx.splitBill.create({ data: { transactionId: transaction.id, totalAmount: transactionAmount, personalAmount: 0, status: SplitBillStatus.OPEN, note: input.note?.trim() || null } });
    const participants = await Promise.all(input.participants.map((participant) => tx.splitBillParticipant.create({ data: { splitBillId: splitBill.id, name: participant.isMe ? "You" : participant.name.trim(), isMe: participant.isMe } })));
    const shareTotals = participants.map(() => new Prisma.Decimal(0));

    for (const inputItem of input.items) {
      const itemAmount = decimal(inputItem.quantity).mul(decimal(inputItem.unitPrice));
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
    const personalAmount = shareTotals[personalIndex];
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { personalAmount } });

    for (let index = 0; index < participants.length; index += 1) {
      await tx.splitBillParticipant.update({ where: { id: participants[index].id }, data: { shareAmount: shareTotals[index] } });
      if (!input.participants[index].isMe && shareTotals[index].gt(0)) {
        await tx.receivable.create({ data: { personName: participants[index].name, description: `Split Bill: ${transaction.note || "Shared expense"}`, amount: shareTotals[index], currencyId: transaction.wallet.currencyId, sourceWalletId: transaction.wallet.id, loanDate: transaction.transactionDate, sourceTransactionId: transaction.id, splitBillParticipantId: participants[index].id } });
      }
    }

    return splitBill;
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
