import { Prisma, TransferOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function affectsCurrentBalance(transactionDate: Date, createdAt: Date, balanceAsOf: Date | null) {
  if (!balanceAsOf) return true;
  const transactionDay = Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate());
  const snapshotDay = Date.UTC(balanceAsOf.getUTCFullYear(), balanceAsOf.getUTCMonth(), balanceAsOf.getUTCDate());
  if (transactionDay > snapshotDay) return true;
  if (transactionDay < snapshotDay) return false;
  return createdAt > balanceAsOf;
}

async function context(tx: Prisma.TransactionClient, statementId: string, sourceWalletId: string, amount: number, allowance = new Prisma.Decimal(0)) {
  const statement = await tx.creditCardStatement.findUnique({ where: { id: statementId }, include: { creditCard: { select: { walletId: true } } } });
  if (!statement) throw new Error("Statement not found.");
  const [source, card] = await Promise.all([
    tx.wallet.findUnique({ where: { id: sourceWalletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
    tx.wallet.findUnique({ where: { id: statement.creditCard.walletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
  ]);
  if (!source) throw new Error("Payment source wallet not found.");
  if (!card) throw new Error("Credit card wallet not found.");
  if (source.id === card.id) throw new Error("Payment source wallet must be different from the credit card.");
  if (source.currencyId !== card.currencyId) throw new Error("Payment requires the same currency as the credit card.");
  const paymentAmount = new Prisma.Decimal(amount);
  if (source.currentBalance.plus(allowance).lt(paymentAmount)) throw new Error(`Insufficient balance in ${source.name}.`);
  return { statement, source, card, paymentAmount };
}

async function applyTransferBalance(tx: Prisma.TransactionClient, transfer: { transferDate: Date; createdAt: Date; amount: Prisma.Decimal; fromWalletId: string; toWalletId: string }, source: { balanceAsOf: Date | null }, card: { balanceAsOf: Date | null }) {
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, source.balanceAsOf)) await tx.wallet.update({ where: { id: transfer.fromWalletId }, data: { currentBalance: { decrement: transfer.amount } } });
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, card.balanceAsOf)) await tx.wallet.update({ where: { id: transfer.toWalletId }, data: { currentBalance: { increment: transfer.amount } } });
}

export async function createCreditCardPaymentTransfer(tx: Prisma.TransactionClient, statementId: string, sourceWalletId: string, amount: number, paidAt: Date) {
  const { statement, source, card, paymentAmount } = await context(tx, statementId, sourceWalletId, amount);
  const transfer = await tx.transfer.create({ data: { transferDate: paidAt, fromWalletId: source.id, toWalletId: card.id, amount: paymentAmount, feeAmount: 0, origin: TransferOrigin.CREDIT_CARD_PAYMENT } });
  await applyTransferBalance(tx, transfer, source, card);
  return { statement, transfer, paymentAmount };
}

export async function updateCreditCardPaymentTransfer(tx: Prisma.TransactionClient, statementId: string, transferId: string, sourceWalletId: string, amount: number, paidAt: Date) {
  const oldTransfer = await tx.transfer.findUnique({ where: { id: transferId } });
  if (!oldTransfer) throw new Error("Linked transfer not found.");
  const oldSource = await tx.wallet.findUnique({ where: { id: oldTransfer.fromWalletId }, select: { id: true, balanceAsOf: true } });
  const oldCard = await tx.wallet.findUnique({ where: { id: oldTransfer.toWalletId }, select: { id: true, balanceAsOf: true } });
  if (!oldSource || !oldCard) throw new Error("Linked transfer wallets not found.");
  if (affectsCurrentBalance(oldTransfer.transferDate, oldTransfer.createdAt, oldSource.balanceAsOf)) await tx.wallet.update({ where: { id: oldSource.id }, data: { currentBalance: { increment: oldTransfer.amount } } });
  if (affectsCurrentBalance(oldTransfer.transferDate, oldTransfer.createdAt, oldCard.balanceAsOf)) await tx.wallet.update({ where: { id: oldCard.id }, data: { currentBalance: { decrement: oldTransfer.amount } } });
  const { statement, source, card, paymentAmount } = await context(tx, statementId, sourceWalletId, amount, oldTransfer.fromWalletId === sourceWalletId ? oldTransfer.amount : new Prisma.Decimal(0));
  await tx.transfer.update({ where: { id: transferId }, data: { transferDate: paidAt, fromWalletId: source.id, toWalletId: card.id, amount: paymentAmount, feeAmount: 0, origin: TransferOrigin.CREDIT_CARD_PAYMENT } });
  const updatedTransfer = { transferDate: paidAt, createdAt: oldTransfer.createdAt, amount: paymentAmount, fromWalletId: source.id, toWalletId: card.id };
  await applyTransferBalance(tx, updatedTransfer, source, card);
  return { statement, paymentAmount };
}

export async function deleteCreditCardPaymentTransfer(tx: Prisma.TransactionClient, transferId: string) {
  const transfer = await tx.transfer.findUnique({ where: { id: transferId } });
  if (!transfer) throw new Error("Linked transfer not found.");
  const source = await tx.wallet.findUnique({ where: { id: transfer.fromWalletId }, select: { id: true, balanceAsOf: true } });
  const card = await tx.wallet.findUnique({ where: { id: transfer.toWalletId }, select: { id: true, balanceAsOf: true } });
  if (!source || !card) throw new Error("Linked transfer wallets not found.");
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, source.balanceAsOf)) await tx.wallet.update({ where: { id: source.id }, data: { currentBalance: { increment: transfer.amount } } });
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, card.balanceAsOf)) await tx.wallet.update({ where: { id: card.id }, data: { currentBalance: { decrement: transfer.amount } } });
  await tx.transfer.delete({ where: { id: transferId } });
}
