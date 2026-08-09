import { CreditCardStatementStatus, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function dateAtDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function getClosedStatementPeriod(referenceDate: Date, billingDay: number) {
  const current = new Date(referenceDate);
  const currentBilling = dateAtDay(current.getFullYear(), current.getMonth(), billingDay);
  const statementDate = current >= currentBilling ? currentBilling : dateAtDay(current.getFullYear(), current.getMonth() - 1, billingDay);
  const periodEnd = statementDate;
  const periodStart = new Date(dateAtDay(statementDate.getFullYear(), statementDate.getMonth() - 1, billingDay));
  periodStart.setDate(periodStart.getDate() + 1);
  return { periodStart, periodEnd, statementDate };
}

export function getOpenStatementPeriod(referenceDate: Date, billingDay: number) {
  const current = new Date(referenceDate);
  const closed = getClosedStatementPeriod(current, billingDay);
  const nextStatementDate = dateAtDay(closed.statementDate.getFullYear(), closed.statementDate.getMonth() + 1, billingDay);
  const periodStart = new Date(closed.periodEnd);
  periodStart.setDate(periodStart.getDate() + 1);
  return { periodStart, periodEnd: current, statementDate: nextStatementDate };
}

export function getDueDate(statementDate: Date, dueDay: number) {
  const candidate = dateAtDay(statementDate.getFullYear(), statementDate.getMonth(), dueDay);
  return candidate > statementDate ? candidate : dateAtDay(statementDate.getFullYear(), statementDate.getMonth() + 1, dueDay);
}

export async function calculateStatementAmount(walletId: string, periodStart: Date, periodEnd: Date) {
  const transactions = await prisma.transaction.findMany({ where: { walletId, transactionDate: { gt: periodStart, lte: periodEnd } }, select: { amount: true, type: true } });
  return transactions.reduce((total, transaction) => {
    const amount = Number(transaction.amount);
    return transaction.type === TransactionType.EXPENSE ? total + amount : total - amount;
  }, 0);
}

export async function getStatementForecast(walletId: string, referenceDate = new Date()) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) return null;
  const period = getOpenStatementPeriod(referenceDate, profile.billingDate);
  const amount = await calculateStatementAmount(walletId, period.periodStart, period.periodEnd);
  return { ...period, dueDate: getDueDate(period.statementDate, profile.dueDate), amount };
}

function getStatus(target: number, paidAmount: number, dueDate: Date) {
  if (paidAmount >= target) return CreditCardStatementStatus.PAID;
  if (new Date() > dueDate) return CreditCardStatementStatus.OVERDUE;
  if (paidAmount > 0) return CreditCardStatementStatus.PARTIALLY_PAID;
  return CreditCardStatementStatus.UNPAID;
}

async function refreshStatementPaymentTotals(statementId: string) {
  const statement = await prisma.creditCardStatement.findUnique({ where: { id: statementId } });
  if (!statement) throw new Error("Statement not found.");

  const [payments, latestPayment] = await Promise.all([
    prisma.creditCardStatementPayment.aggregate({ where: { statementId }, _sum: { amount: true } }),
    prisma.creditCardStatementPayment.findFirst({ where: { statementId }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] }),
  ]);
  const paidAmount = Number(payments._sum.amount ?? 0);
  const target = Number(statement.actualAmount ?? statement.calculatedAmount);

  await prisma.creditCardStatement.update({
    where: { id: statementId },
    data: {
      paidAmount,
      paidAt: latestPayment?.paidAt ?? null,
      status: getStatus(target, paidAmount, statement.dueDate),
    },
  });

  return paidAmount;
}

export async function ensureStatement(walletId: string, referenceDate = new Date()) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) throw new Error("Credit card profile not found.");
  const { periodStart, periodEnd, statementDate } = getClosedStatementPeriod(referenceDate, profile.billingDate);
  const dueDate = getDueDate(statementDate, profile.dueDate);
  const calculatedAmount = await calculateStatementAmount(walletId, periodStart, periodEnd);
  const existing = await prisma.creditCardStatement.findUnique({ where: { creditCardId_periodStart_periodEnd: { creditCardId: profile.id, periodStart, periodEnd } } });
  if (existing) {
    const target = Number(existing.actualAmount ?? existing.calculatedAmount);
    const paidAmount = Number(existing.paidAmount);
    return prisma.creditCardStatement.update({ where: { id: existing.id }, data: { calculatedAmount, status: getStatus(target, paidAmount, existing.dueDate) } });
  }
  return prisma.creditCardStatement.create({ data: { creditCardId: profile.id, periodStart, periodEnd, statementDate, dueDate, calculatedAmount, status: getStatus(calculatedAmount, 0, dueDate) } });
}

export async function createManualStatement(walletId: string, input: { periodStart: Date; periodEnd: Date; statementDate: Date; dueDate: Date; actualAmount: number }) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) throw new Error("Credit card profile not found.");
  const existing = await prisma.creditCardStatement.findUnique({ where: { creditCardId_periodStart_periodEnd: { creditCardId: profile.id, periodStart: input.periodStart, periodEnd: input.periodEnd } } });
  if (existing) throw new Error("A statement already exists for this billing period.");
  return prisma.creditCardStatement.create({ data: { creditCardId: profile.id, periodStart: input.periodStart, periodEnd: input.periodEnd, statementDate: input.statementDate, dueDate: input.dueDate, calculatedAmount: 0, actualAmount: input.actualAmount, status: getStatus(input.actualAmount, 0, input.dueDate) } });
}

export async function recordStatementPayment(statementId: string, amount: number, paidAt: Date, note?: string) {
  const statement = await prisma.creditCardStatement.findUnique({ where: { id: statementId } });
  if (!statement) throw new Error("Statement not found.");
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const payment = await prisma.creditCardStatementPayment.create({ data: { statementId, amount, paidAt, note: note?.trim() || null } });
  await refreshStatementPaymentTotals(statementId);
  return payment;
}

export async function updateStatementPayment(paymentId: string, amount: number, paidAt: Date, note?: string) {
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const payment = await prisma.creditCardStatementPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found.");
  await prisma.creditCardStatementPayment.update({ where: { id: paymentId }, data: { amount, paidAt, note: note?.trim() || null } });
  await refreshStatementPaymentTotals(payment.statementId);
}

export async function deleteStatementPayment(paymentId: string) {
  const payment = await prisma.creditCardStatementPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found.");
  await prisma.creditCardStatementPayment.delete({ where: { id: paymentId } });
  await refreshStatementPaymentTotals(payment.statementId);
}

export async function updateCreditCardRewardPoint(walletId: string, rewardPoint: number) {
  if (rewardPoint < 0) throw new Error("Reward points cannot be negative.");
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) throw new Error("Credit card profile not found.");
  return prisma.creditCardProfile.update({ where: { walletId }, data: { rewardPoint } });
}

export async function getCreditCardStatements(walletId: string) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) return [];
  return prisma.creditCardStatement.findMany({ where: { creditCardId: profile.id }, include: { payments: { orderBy: { paidAt: "desc" } } }, orderBy: { statementDate: "desc" }, take: 12 });
}
