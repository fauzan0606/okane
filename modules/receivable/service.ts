import { Prisma, ReceivableStatus, TransactionKind, WalletType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getStatus(amount: Prisma.Decimal, received: Prisma.Decimal, dueDate: Date | null) {
  if (received.gte(amount)) return ReceivableStatus.RECEIVED;
  if (received.gt(0)) return ReceivableStatus.PARTIALLY_RECEIVED;
  if (dueDate && dueDate < new Date()) return ReceivableStatus.OVERDUE;
  return ReceivableStatus.OUTSTANDING;
}

function affectsCurrentBalance(transactionDate: Date, createdAt: Date, balanceAsOf: Date | null) {
  if (!balanceAsOf) return true;
  const transactionDay = Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate());
  const snapshotDay = Date.UTC(balanceAsOf.getUTCFullYear(), balanceAsOf.getUTCMonth(), balanceAsOf.getUTCDate());
  if (transactionDay > snapshotDay) return true;
  if (transactionDay < snapshotDay) return false;
  return createdAt > balanceAsOf;
}

export async function getReceivables() {
  const receivables = await prisma.receivable.findMany({ include: { currency: { select: { code: true, symbol: true } }, sourceWallet: { select: { id: true, name: true, walletType: true } }, payments: { orderBy: { receivedAt: "desc" }, include: { wallet: { select: { name: true, currency: { select: { symbol: true, code: true } } } } } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }] });
  return receivables.map((item) => ({ ...item, amount: Number(item.amount), receivedAmount: Number(item.receivedAmount), remaining: Math.max(Number(item.amount) - Number(item.receivedAmount), 0), payments: item.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })) }));
}

export async function getReceivableSummary(currencyCode = "IDR") {
  const items = await prisma.receivable.findMany({ where: { currency: { code: currencyCode } }, select: { amount: true, receivedAmount: true } });
  return items.reduce((sum, item) => sum + Math.max(Number(item.amount) - Number(item.receivedAmount), 0), 0);
}

export async function createReceivable(input: { personName: string; description: string; amount: number; currencyId: string; sourceWalletId: string; dueDate?: Date | null; sourceTransactionId?: string | null }) {
  if (input.amount <= 0) throw new Error("Receivable amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: input.sourceWalletId }, select: { id: true, currencyId: true, walletType: true, currentBalance: true, balanceAsOf: true } });
    if (!wallet) throw new Error("Source wallet not found.");
    if (wallet.currencyId !== input.currencyId) throw new Error("Source wallet currency must match the receivable currency.");

    const receivable = await tx.receivable.create({ data: { personName: input.personName.trim(), description: input.description.trim(), amount: input.amount, currency: { connect: { id: input.currencyId } }, sourceWallet: { connect: { id: input.sourceWalletId } }, dueDate: input.dueDate ?? null, sourceTransactionId: input.sourceTransactionId ?? null } });

    // A direct loan from a cash/bank/e-wallet/etc. really leaves the wallet now.
    // A credit-card receivable normally comes from an existing CC transaction, so
    // changing currentBalance here would double-count the card's outstanding balance.
    const shouldReduceWallet = wallet.walletType !== WalletType.CREDIT_CARD;
    const createdAt = receivable.createdAt;
    const effectiveDate = createdAt;
    if (shouldReduceWallet && affectsCurrentBalance(effectiveDate, createdAt, wallet.balanceAsOf)) {
      await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { decrement: input.amount } } });
    }

    return receivable;
  });
}

export async function recordReceivablePayment(input: { receivableId: string; amount: number; receivedAt: Date; walletId: string; note?: string }) {
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({ where: { id: input.receivableId }, include: { currency: true } });
    if (!receivable) throw new Error("Receivable not found.");
    const remaining = new Prisma.Decimal(receivable.amount).minus(receivable.receivedAmount);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.gt(remaining)) throw new Error("Payment cannot exceed the remaining receivable.");
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, balanceAsOf: true, currencyId: true } });
    if (!wallet) throw new Error("Wallet not found.");
    if (wallet.currencyId !== receivable.currencyId) throw new Error("Payment wallet currency must match the receivable currency.");

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
    if (affectsCurrentBalance(input.receivedAt, transaction.createdAt, wallet.balanceAsOf)) await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { increment: amount } } });
    return payment;
  });
}

export async function refreshReceivableStatuses() {
  const items = await prisma.receivable.findMany({ where: { status: { in: ["OUTSTANDING", "PARTIALLY_RECEIVED"] } } });
  await Promise.all(items.map((item) => { const status = getStatus(new Prisma.Decimal(item.amount), new Prisma.Decimal(item.receivedAmount), item.dueDate); return status !== item.status ? prisma.receivable.update({ where: { id: item.id }, data: { status } }) : null; }));
}
