import { Prisma, ReceivableStatus, SplitBillItemMethod, SplitBillStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function updateSplitBillItemAllocation(input: { splitBillId: string; itemId: string; splitMethod: "EQUAL" | "PRO_RATA"; allocations: { participantId: string; units: number }[] }) {
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.findUnique({
      where: { id: input.splitBillId },
      include: {
        participants: { include: { receivable: { include: { payments: true } } } },
        items: { include: { allocations: true }, orderBy: { id: "asc" } },
      },
    });
    if (!splitBill) throw new Error("Split Bill not found.");
    if (splitBill.status !== SplitBillStatus.DRAFT && splitBill.status !== SplitBillStatus.OPEN) throw new Error("This Split Bill cannot be edited in its current status.");
    const item = splitBill.items.find((entry) => entry.id === input.itemId);
    if (!item) throw new Error("Split Bill item not found.");
    if (item.name === "Tax / PPN" || item.name === "Service Fee") throw new Error("Tax and service fee are recalculated automatically.");

    const participantIds = new Set(splitBill.participants.map((participant) => participant.id));
    const raw = input.allocations.filter((allocation) => participantIds.has(allocation.participantId) && Number(allocation.units) > 0).map((allocation) => ({ participantId: allocation.participantId, units: new Prisma.Decimal(allocation.units) }));
    if (raw.length === 0) throw new Error("Choose at least one person for this item.");
    const units = input.splitMethod === "EQUAL" ? raw.map((allocation) => ({ ...allocation, units: new Prisma.Decimal(1) })) : raw;
    const unitTotal = units.reduce((sum, allocation) => sum.plus(allocation.units), new Prisma.Decimal(0));
    if (unitTotal.lte(0)) throw new Error("The selected allocation is invalid.");
    const itemAmount = new Prisma.Decimal(item.quantity).mul(item.unitPrice);

    await tx.splitBillItemAllocation.deleteMany({ where: { itemId: item.id } });
    for (const allocation of units) await tx.splitBillItemAllocation.create({ data: { itemId: item.id, participantId: allocation.participantId, units: allocation.units, amount: allocation.units.div(unitTotal).mul(itemAmount) } });
    await tx.splitBillItem.update({ where: { id: item.id }, data: { splitMethod: input.splitMethod === "PRO_RATA" ? SplitBillItemMethod.PRO_RATA : SplitBillItemMethod.EQUAL } });

    const participantShares = new Map(splitBill.participants.map((participant) => [participant.id, new Prisma.Decimal(0)]));
    const freshItems = await tx.splitBillItem.findMany({ where: { splitBillId: splitBill.id }, include: { allocations: true } });
    const baseItems = freshItems.filter((entry) => entry.name !== "Tax / PPN" && entry.name !== "Service Fee");
    const subtotal = baseItems.reduce((sum, entry) => sum.plus(new Prisma.Decimal(entry.quantity).mul(entry.unitPrice)), new Prisma.Decimal(0));
    for (const entry of baseItems) for (const allocation of entry.allocations) participantShares.set(allocation.participantId, (participantShares.get(allocation.participantId) ?? new Prisma.Decimal(0)).plus(allocation.amount));

    const chargeItems = freshItems.filter((entry) => entry.name === "Tax / PPN" || entry.name === "Service Fee");
    for (const chargeItem of chargeItems) {
      const amount = new Prisma.Decimal(chargeItem.unitPrice);
      await tx.splitBillItemAllocation.deleteMany({ where: { itemId: chargeItem.id } });
      if (subtotal.gt(0) && amount.gt(0)) for (const participant of splitBill.participants) {
        const base = participantShares.get(participant.id) ?? new Prisma.Decimal(0);
        if (base.lte(0)) continue;
        const allocation = base.div(subtotal).mul(amount);
        await tx.splitBillItemAllocation.create({ data: { itemId: chargeItem.id, participantId: participant.id, units: base, amount: allocation } });
        participantShares.set(participant.id, base.plus(allocation));
      }
    }

    const personal = splitBill.participants.find((participant) => participant.isMe);
    const totalAmount = freshItems.reduce((sum, entry) => sum.plus(new Prisma.Decimal(entry.quantity).mul(entry.unitPrice)), new Prisma.Decimal(0));
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { totalAmount, personalAmount: personal ? participantShares.get(personal.id) ?? 0 : 0 } });

    for (const participant of splitBill.participants) {
      const share = participantShares.get(participant.id) ?? new Prisma.Decimal(0);
      await tx.splitBillParticipant.update({ where: { id: participant.id }, data: { shareAmount: share } });
      if (participant.isMe) continue;
      const receivable = participant.receivable;
      const paid = receivable?.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)) ?? new Prisma.Decimal(0);
      if (receivable && share.lt(paid)) throw new Error(`${participant.name}'s new share cannot be lower than payments already received.`);
      if (receivable && share.gt(0)) {
        const status = paid.gte(share) ? ReceivableStatus.RECEIVED : paid.gt(0) ? ReceivableStatus.PARTIALLY_RECEIVED : receivable.dueDate && receivable.dueDate < new Date() ? ReceivableStatus.OVERDUE : ReceivableStatus.OUTSTANDING;
        await tx.receivable.update({ where: { id: receivable.id }, data: { amount: share, status } });
      } else if (receivable && paid.isZero()) {
        await tx.receivable.delete({ where: { id: receivable.id } });
      } else if (!receivable && share.gt(0) && splitBill.transactionId) {
        const transaction = await tx.transaction.findUnique({ where: { id: splitBill.transactionId }, include: { wallet: { select: { id: true, currencyId: true } } } });
        if (!transaction) throw new Error("Linked transaction not found.");
        await tx.receivable.create({ data: { personName: participant.name, description: `Split Bill: ${splitBill.merchantName}`, amount: share, currencyId: transaction.wallet.currencyId, sourceWalletId: transaction.wallet.id, loanDate: transaction.transactionDate, sourceTransactionId: transaction.id, splitBillParticipantId: participant.id } });
      }
    }
    return true;
  });
}
