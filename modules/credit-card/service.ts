import { CreditCardStatementStatus, Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getInstallmentAmount, getInstallmentOccurrence } from "@/modules/transaction/installment";

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

function installmentAmountInPeriod(plan: { totalAmount: Prisma.Decimal; installmentAmount: Prisma.Decimal; tenorMonths: number; startDate: Date }, periodStart: Date, periodEnd: Date) {
  for (let number = 1; number <= plan.tenorMonths; number += 1) {
    const occurrence = getInstallmentOccurrence(plan.startDate, number);
    if (occurrence > periodStart && occurrence <= periodEnd) return getInstallmentAmount(plan.totalAmount, plan.installmentAmount, number, plan.tenorMonths);
  }
  return null;
}

export async function calculateStatementAmount(walletId: string, periodStart: Date, periodEnd: Date) {
  const [regularTransactions, installmentTransactions] = await Promise.all([
    prisma.transaction.findMany({ where: { walletId, installmentPlan: null, transactionDate: { gt: periodStart, lte: periodEnd } }, select: { amount: true, type: true } }),
    prisma.transaction.findMany({ where: { walletId, installmentPlan: { isNot: null } }, select: { type: true, installmentPlan: { select: { totalAmount: true, installmentAmount: true, tenorMonths: true, startDate: true } } } }),
  ]);
  const regularTotal = regularTransactions.reduce((total, transaction) => total + (transaction.type === TransactionType.EXPENSE ? Number(transaction.amount) : -Number(transaction.amount)), 0);
  const installmentTotal = installmentTransactions.reduce((total, transaction) => {
    if (transaction.type !== TransactionType.EXPENSE || !transaction.installmentPlan) return total;
    const amount = installmentAmountInPeriod(transaction.installmentPlan, periodStart, periodEnd);
    return amount ? total + Number(amount) : total;
  }, 0);
  return regularTotal + installmentTotal;
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
  await prisma.creditCardStatement.update({ where: { id: statementId }, data: { paidAmount, paidAt: latestPayment?.paidAt ?? null, status: getStatus(target, paidAmount, statement.dueDate) } });
  return paidAmount;
}

function affectsCurrentBalance(transactionDate: Date, createdAt: Date, balanceAsOf: Date | null) {
  if (!balanceAsOf) return true;
  const transactionDay = Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate());
  const snapshotDay = Date.UTC(balanceAsOf.getUTCFullYear(), balanceAsOf.getUTCMonth(), balanceAsOf.getUTCDate());
  if (transactionDay > snapshotDay) return true;
  if (transactionDay < snapshotDay) return false;
  return createdAt > balanceAsOf;
}

async function getPaymentContext(tx: Prisma.TransactionClient, statementId: string, sourceWalletId: string, amount: number) {
  const statement = await tx.creditCardStatement.findUnique({ where: { id: statementId }, include: { creditCard: { select: { walletId: true } } } });
  if (!statement) throw new Error("Statement not found.");
  const [sourceWallet, cardWallet] = await Promise.all([
    tx.wallet.findUnique({ where: { id: sourceWalletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
    tx.wallet.findUnique({ where: { id: statement.creditCard.walletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
  ]);
  if (!sourceWallet) throw new Error("Payment source wallet not found.");
  if (!cardWallet) throw new Error("Credit card wallet not found.");
  if (sourceWallet.id === cardWallet.id) throw new Error("Payment source wallet must be different from the credit card.");
  if (sourceWallet.currencyId !== cardWallet.currencyId) throw new Error("Payment requires the same currency as the credit card.");
  const paymentAmount = new Prisma.Decimal(amount);
  if (sourceWallet.currentBalance.lt(paymentAmount)) throw new Error(`Insufficient balance in ${sourceWallet.name}.`);
  return { statement, sourceWallet, cardWallet, paymentAmount };
}

async function applyPaymentTransferBalance(tx: Prisma.TransactionClient, transfer: { transferDate: Date; createdAt: Date; amount: Prisma.Decimal; fromWalletId: string; toWalletId: string }, source: { balanceAsOf: Date | null }, destination: { balanceAsOf: Date | null }) {
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, source.balanceAsOf)) await tx.wallet.update({ where: { id: transfer.fromWalletId }, data: { currentBalance: { decrement: transfer.amount } } });
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, destination.balanceAsOf)) await tx.wallet.update({ where: { id: transfer.toWalletId }, data: { currentBalance: { increment: transfer.amount } } });
}

export async function ensureStatement(walletId: string, referenceDate = new Date()) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) throw new Error("Credit card profile not found.");
  const { periodStart, periodEnd, statementDate } = getClosedStatementPeriod(referenceDate, profile.billingDate);
  const dueDate = getDueDate(statementDate, profile.dueDate);
  const calculatedAmount = await calculateStatementAmount(walletId, periodStart, periodEnd);
  const existing = await prisma.creditCardStatement.findUnique({ where: { creditCardId_periodStart_periodEnd: { creditCardId: profile.id, periodStart, periodEnd } } });
  if (existing) {
    const target = Number(existing.actualAmount ?? calculatedAmount);
    const paidAmount = Number(existing.paidAmount);
    return prisma.creditCardStatement.update({ where: { id: existing.id }, data: { calculatedAmount, status: getStatus(target, paidAmount, existing.dueDate) } });
  }
  return prisma.creditCardStatement.create({ data: { creditCardId: profile.id, periodStart, periodEnd, statementDate, dueDate, calculatedAmount, status: getStatus(calculatedAmount, 0, dueDate) } });
}

export async function getStatementForecast(walletId: string, referenceDate = new Date()) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) return null;
  const period = getOpenStatementPeriod(referenceDate, profile.billingDate);
  const amount = await calculateStatementAmount(walletId, period.periodStart, period.periodEnd);
  return { ...period, dueDate: getDueDate(period.statementDate, profile.dueDate), amount };
}

export async function createManualStatement(walletId: string, input: { periodStart: Date; periodEnd: Date; statementDate: Date; dueDate: Date; actualAmount: number }) {
  const profile = await prisma.creditCardProfile.findUnique({ where: { walletId } });
  if (!profile) throw new Error("Credit card profile not found.");
  const existing = await prisma.creditCardStatement.findUnique({ where: { creditCardId_periodStart_periodEnd: { creditCardId: profile.id, periodStart: input.periodStart, periodEnd: input.periodEnd } } });
  if (existing) throw new Error("A statement already exists for this billing period.");
  return prisma.creditCardStatement.create({ data: { creditCardId: profile.id, periodStart: input.periodStart, periodEnd: input.periodEnd, statementDate: input.statementDate, dueDate: input.dueDate, calculatedAmount: await calculateStatementAmount(walletId, input.periodStart, input.periodEnd), actualAmount: input.actualAmount, status: getStatus(input.actualAmount, 0, input.dueDate) } });
}

export async function recordStatementPayment(statementId: string, sourceWalletId: string, amount: number, paidAt: Date, note?: string) {
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const { statement, sourceWallet, cardWallet, paymentAmount } = await getPaymentContext(tx, statementId, sourceWalletId, amount);
    const transfer = await tx.transfer.create({ data: { transferDate: paidAt, fromWalletId: sourceWallet.id, toWalletId: cardWallet.id, amount: paymentAmount, feeAmount: 0, origin: "CREDIT_CARD_PAYMENT" } });
    await applyPaymentTransferBalance(tx, transfer, sourceWallet, cardWallet);
    const payment = await tx.creditCardStatementPayment.create({ data: { statementId, amount: paymentAmount, paidAt, note: note?.trim() || null, transferId: transfer.id } });
    const [payments, latestPayment] = await Promise.all([
      tx.creditCardStatementPayment.aggregate({ where: { statementId }, _sum: { amount: true } }),
      tx.creditCardStatementPayment.findFirst({ where: { statementId }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] }),
    ]);
    const paidAmount = Number(payments._sum.amount ?? 0);
    const target = Number(statement.actualAmount ?? statement.calculatedAmount);
    await tx.creditCardStatement.update({ where: { id: statementId }, data: { paidAmount, paidAt: latestPayment?.paidAt ?? null, status: getStatus(target, paidAmount, statement.dueDate) } });
    return payment;
  });
}

export async function updateStatementPayment(paymentId: string, sourceWalletId: string, amount: number, paidAt: Date, note?: string) {
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditCardStatementPayment.findUnique({ where: { id: paymentId }, include: { transfer: true } });
    if (!existing) throw new Error("Payment not found.");
    if (!existing.transfer) throw new Error("This payment has no linked transfer. It must be repaired before editing.");
    const { statement, sourceWallet, cardWallet, paymentAmount } = await getPaymentContext(tx, existing.statementId, sourceWalletId, amount);
    const oldTransfer = await tx.transfer.findUnique({ where: { id: existing.transfer.id } });
    if (!oldTransfer) throw new Error("Linked transfer not found.");
    const oldSource = await tx.wallet.findUnique({ where: { id: oldTransfer.fromWalletId }, select: { id: true, balanceAsOf: true } });
    const oldDestination = await tx.wallet.findUnique({ where: { id: oldTransfer.toWalletId }, select: { id: true, balanceAsOf: true } });
    if (!oldSource || !oldDestination) throw new Error("Linked transfer wallets not found.");
    if (affectsCurrentBalance(oldTransfer.transferDate, oldTransfer.createdAt, oldSource.balanceAsOf)) await tx.wallet.update({ where: { id: oldSource.id }, data: { currentBalance: { increment: oldTransfer.amount } } });
    if (affectsCurrentBalance(oldTransfer.transferDate, oldTransfer.createdAt, oldDestination.balanceAsOf)) await tx.wallet.update({ where: { id: oldDestination.id }, data: { currentBalance: { decrement: oldTransfer.amount } } });
    await tx.transfer.update({ where: { id: oldTransfer.id }, data: { transferDate: paidAt, fromWalletId: sourceWallet.id, toWalletId: cardWallet.id, amount: paymentAmount } });
    if (affectsCurrentBalance(paidAt, oldTransfer.createdAt, sourceWallet.balanceAsOf)) await tx.wallet.update({ where: { id: sourceWallet.id }, data: { currentBalance: { decrement: paymentAmount } } });
    if (affectsCurrentBalance(paidAt, oldTransfer.createdAt, cardWallet.balanceAsOf)) await tx.wallet.update({ where: { id: cardWallet.id }, data: { currentBalance: { increment: paymentAmount } } });
    await tx.creditCardStatementPayment.update({ where: { id: paymentId }, data: { amount: paymentAmount, paidAt, note: note?.trim() || null, transferId: oldTransfer.id } });
    const [payments, latestPayment] = await Promise.all([
      tx.creditCardStatementPayment.aggregate({ where: { statementId: statement.id }, _sum: { amount: true } }),
      tx.creditCardStatementPayment.findFirst({ where: { statementId: statement.id }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] }),
    ]);
    const paidAmount = Number(payments._sum.amount ?? 0);
    const target = Number(statement.actualAmount ?? statement.calculatedAmount);
    await tx.creditCardStatement.update({ where: { id: statement.id }, data: { paidAmount, paidAt: latestPayment?.paidAt ?? null, status: getStatus(target, paidAmount, statement.dueDate) } });
  });
}

export async function deleteStatementPayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.creditCardStatementPayment.findUnique({ where: { id: paymentId }, include: { transfer: true } });
    if (!payment) throw new Error("Payment not found.");
    if (payment.transfer) {
      const source = await tx.wallet.findUnique({ where: { id: payment.transfer.fromWalletId }, select: { id: true, balanceAsOf: true } });
      const destination = await tx.wallet.findUnique({ where: { id: payment.transfer.toWalletId }, select: { id: true, balanceAsOf: true } });
      if (!source || !destination) throw new Error("Linked transfer wallets not found.");
      if (affectsCurrentBalance(payment.transfer.transferDate, payment.transfer.createdAt, source.balanceAsOf)) await tx.wallet.update({ where: { id: source.id }, data: { currentBalance: { increment: payment.transfer.amount } } });
      if (affectsCurrentBalance(payment.transfer.transferDate, payment.transfer.createdAt, destination.balanceAsOf)) await tx.wallet.update({ where: { id: destination.id }, data: { currentBalance: { decrement: payment.transfer.amount } } });
      await tx.transfer.delete({ where: { id: payment.transfer.id } });
    }
    await tx.creditCardStatementPayment.delete({ where: { id: paymentId } });
    const statement = await tx.creditCardStatement.findUnique({ where: { id: payment.statementId } });
    if (!statement) throw new Error("Statement not found.");
    const [payments, latestPayment] = await Promise.all([
      tx.creditCardStatementPayment.aggregate({ where: { statementId: payment.statementId }, _sum: { amount: true } }),
      tx.creditCardStatementPayment.findFirst({ where: { statementId: payment.statementId }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] }),
    ]);
    const paidAmount = Number(payments._sum.amount ?? 0);
    const target = Number(statement.actualAmount ?? statement.calculatedAmount);
    await tx.creditCardStatement.update({ where: { id: statement.id }, data: { paidAmount, paidAt: latestPayment?.paidAt ?? null, status: getStatus(target, paidAmount, statement.dueDate) } });
  });
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
  return prisma.creditCardStatement.findMany({ where: { creditCardId: profile.id }, include: { payments: { include: { transfer: { include: { fromWallet: { select: { id: true, name: true, currency: { select: { code: true, symbol: true } } } } } } }, orderBy: { paidAt: "desc" } }, orderBy: { statementDate: "desc" }, take: 12 });
}
