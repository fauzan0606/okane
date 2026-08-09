import { Prisma, ReceivableStatus, TransactionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getStatus(amount: Prisma.Decimal, received: Prisma.Decimal, dueDate: Date | null) {
  if (received.gte(amount)) return ReceivableStatus.RECEIVED;
  if (received.gt(0)) return ReceivableStatus.PARTIALLY_RECEIVED;
  if (dueDate && dueDate < new Date()) return ReceivableStatus.OVERDUE;
  return ReceivableStatus.OUTSTANDING;
}

export async function getReceivables() {
  const receivables = await prisma.receivable.findMany({
    include: { payments: { orderBy: { receivedAt: "desc" }, include: { wallet: { select: { name: true, currency: { select: { symbol: true, code: true } } } } } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  return receivables.map((item) => ({
    ...item,
    amount: Number(item.amount),
    receivedAmount: Number(item.receivedAmount),
    remaining: Math.max(Number(item.amount) - Number(item.receivedAmount), 0),
    payments: item.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
  }));
}

export async function getReceivableSummary() {
  const items = await prisma.receivable.findMany({ select: { amount: true, receivedAmount: true } });
  return items.reduce((sum, item) => sum + Math.max(Number(item.amount) - Number(item.receivedAmount), 0), 0);
}

export async function createReceivable(input: { personName: string; description: string; amount: number; dueDate?: Date | null; sourceTransactionId?: string | null }) {
  if (input.amount <= 0) throw new Error("Receivable amount must be greater than zero.");
  return prisma.receivable.create({ data: { personName: input.personName.trim(), description: input.description.trim(), amount: input.amount, dueDate: input.dueDate ?? null, sourceTransactionId: input.sourceTransactionId ?? null } });
}

export async function recordReceivablePayment(input: { receivableId: string; amount: number; receivedAt: Date; walletId: string; note?: string }) {
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({ where: { id: input.receivableId } });
    if (!receivable) throw new Error("Receivable not found.");
    const remaining = new Prisma.Decimal(receivable.amount).minus(receivable.receivedAmount);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.gt(remaining)) throw new Error("Payment cannot exceed the remaining receivable.");
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, balanceAsOf: true } });
    if (!wallet) throw new Error("Wallet not found.");
    const transaction = await tx.transaction.create({
      data: {
        transactionDate: input.receivedAt,
        type: "INCOME",
        kind: TransactionKind.REIMBURSEMENT,
        amount,
        note: input.note?.trim() || `Reimbursement from ${receivable.personName}: ${receivable.description}`,
        wallet: { connect: { id: input.walletId } },
      },
    });
    const receivedAmount = new Prisma.Decimal(receivable.receivedAmount).plus(amount);
    const status = getStatus(new Prisma.Decimal(receivable.amount), receivedAmount, receivable.dueDate);
    const payment = await tx.receivablePayment.create({ data: { receivableId: receivable.id, amount, receivedAt: input.receivedAt, walletId: input.walletId, transactionId: transaction.id, note: input.note?.trim() || null } });
    await tx.receivable.update({ where: { id: receivable.id }, data: { receivedAmount, status } });
    const delta = amount;
    await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { increment: delta } } });
    return payment;
  });
}

export async function refreshReceivableStatuses() {
  const items = await prisma.receivable.findMany({ where: { status: { in: ["OUTSTANDING", "PARTIALLY_RECEIVED"] } } });
  const now = new Date();
  await Promise.all(items.map((item) => {
    const status = getStatus(new Prisma.Decimal(item.amount), new Prisma.Decimal(item.receivedAmount), item.dueDate);
    return status !== item.status ? prisma.receivable.update({ where: { id: item.id }, data: { status } }) : null;
  }));
  return now;
}
