import { CreditCardStatementStatus, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function dateAtDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function getClosedStatementPeriod(referenceDate: Date, billingDay: number) {
  const current = new Date(referenceDate);
  const currentBilling = dateAtDay(current.getFullYear(), current.getMonth(), billingDay);
  const statementDate = current >= currentBilling
    ? currentBilling
    : dateAtDay(current.getFullYear(), current.getMonth() - 1, billingDay);

  const periodEnd = statementDate;
  const periodStart = new Date(
    dateAtDay(statementDate.getFullYear(), statementDate.getMonth() - 1, billingDay)
  );
  periodStart.setDate(periodStart.getDate() + 1);

  return { periodStart, periodEnd, statementDate };
}

export function getDueDate(statementDate: Date, dueDay: number) {
  const candidate = dateAtDay(statementDate.getFullYear(), statementDate.getMonth(), dueDay);
  if (candidate > statementDate) return candidate;
  return dateAtDay(statementDate.getFullYear(), statementDate.getMonth() + 1, dueDay);
}

export async function calculateStatementAmount(walletId: string, periodStart: Date, periodEnd: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      walletId,
      transactionDate: { gt: periodStart, lte: periodEnd },
    },
    select: { amount: true, type: true },
  });

  return transactions.reduce((total, transaction) => {
    const amount = Number(transaction.amount);
    return transaction.type === TransactionType.EXPENSE ? total + amount : total - amount;
  }, 0);
}

export async function ensureStatement(walletId: string, referenceDate = new Date()) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) throw new Error("Credit card profile not found.");

  const { periodStart, periodEnd, statementDate } = getClosedStatementPeriod(referenceDate, profile.billingDate);
  const dueDate = getDueDate(statementDate, profile.dueDate);
  const calculatedAmount = await calculateStatementAmount(walletId, periodStart, periodEnd);

  const existing = await prisma.creditCardStatement.findUnique({
    where: { creditCardId_periodStart_periodEnd: { creditCardId: profile.id, periodStart, periodEnd } },
  });

  if (existing) {
    const status = existing.paidAmount >= Number(existing.actualAmount ?? existing.calculatedAmount)
      ? CreditCardStatementStatus.PAID
      : new Date() > existing.dueDate
        ? CreditCardStatementStatus.OVERDUE
        : existing.paidAmount > 0
          ? CreditCardStatementStatus.PARTIALLY_PAID
          : CreditCardStatementStatus.UNPAID;

    return prisma.creditCardStatement.update({
      where: { id: existing.id },
      data: { calculatedAmount, status },
    });
  }

  return prisma.creditCardStatement.create({
    data: {
      creditCardId: profile.id,
      periodStart,
      periodEnd,
      statementDate,
      dueDate,
      calculatedAmount,
      status: new Date() > dueDate ? CreditCardStatementStatus.OVERDUE : CreditCardStatementStatus.UNPAID,
    },
  });
}

export async function getCreditCardStatements(walletId: string) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) return [];

  return prisma.creditCardStatement.findMany({
    where: { creditCardId: profile.id },
    orderBy: { statementDate: "desc" },
    take: 12,
  });
}
