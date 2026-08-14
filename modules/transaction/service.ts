import { unstable_noStore as noStore } from "next/cache";
import { Prisma, TransactionType, WalletType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTransactionById, getTransactions } from "./repository";
import { findOrCreatePayeeByName } from "@/modules/payee/service";
import { IMPORT_REVIEW_WALLET_NOTE } from "./importReview";
import type { CreateTransactionInput, UpdateTransactionInput } from "./types";

type BalanceTransaction = { transactionDate: Date; type: "INCOME" | "EXPENSE"; amount: Prisma.Decimal; createdAt: Date };
type BalanceWallet = { balanceAsOf: Date | null; note?: string | null };

function affectsCurrentBalance(transaction: BalanceTransaction, wallet: BalanceWallet) {
  if (wallet.note === IMPORT_REVIEW_WALLET_NOTE) return false;
  const snapshot = wallet.balanceAsOf;
  if (!snapshot) return true;
  const transactionDay = Date.UTC(transaction.transactionDate.getUTCFullYear(), transaction.transactionDate.getUTCMonth(), transaction.transactionDate.getUTCDate());
  const snapshotDay = Date.UTC(snapshot.getUTCFullYear(), snapshot.getUTCMonth(), snapshot.getUTCDate());
  if (transactionDay > snapshotDay) return true;
  if (transactionDay < snapshotDay) return false;
  return transaction.createdAt > snapshot;
}

function balanceDelta(transaction: BalanceTransaction) { return transaction.type === "INCOME" ? transaction.amount : transaction.amount.negated(); }
async function applyBalanceDelta(tx: Prisma.TransactionClient, walletId: string, delta: Prisma.Decimal) {
  if (delta.isZero()) return;
  await tx.wallet.update({ where: { id: walletId }, data: { currentBalance: delta.isPositive() ? { increment: delta } : { decrement: delta.abs() } } });
}

async function validateCategorySelection(tx: Prisma.TransactionClient, categoryId?: string, subcategoryId?: string) {
  if (!categoryId && subcategoryId) throw new Error("Category is required when a subcategory is selected.");
  if (!categoryId) return;
  const category = await tx.category.findUnique({ where: { id: categoryId }, select: { id: true, isActive: true } });
  if (!category || !category.isActive) throw new Error("Category not found or inactive.");
  if (!subcategoryId) return;
  const subcategory = await tx.subcategory.findFirst({ where: { id: subcategoryId, categoryId, isActive: true }, select: { id: true } });
  if (!subcategory) throw new Error("Subcategory does not belong to the selected category.");
}

async function buildInstallmentPlan(tx: Prisma.TransactionClient, walletId: string, input: CreateTransactionInput) {
  const installment = input.installment;
  if (!installment?.enabled) return null;
  if (input.type !== TransactionType.EXPENSE) throw new Error("Installments are available for expense transactions only.");
  if (!installment.tenorMonths || installment.tenorMonths < 2) throw new Error("Installment tenor must be at least 2 months.");
  const wallet = await tx.wallet.findUnique({ where: { id: walletId }, select: { walletType: true } });
  if (!wallet) throw new Error("Wallet not found.");
  if (wallet.walletType !== WalletType.CREDIT_CARD) throw new Error("Installments are available for credit card transactions only.");
  const fee = new Prisma.Decimal(installment.feeAmount ?? 0);
  const totalAmount = new Prisma.Decimal(input.amount).plus(fee);
  const installmentAmount = totalAmount.div(installment.tenorMonths);
  return { totalAmount, feeAmount: fee, installmentAmount, tenorMonths: installment.tenorMonths, startDate: installment.startDate ?? input.transactionDate, status: "ACTIVE" as const };
}

export async function listTransactions() { return getTransactions(); }
export async function findTransaction(id: string) { return getTransactionById(id); }

export async function createTransactionService(input: CreateTransactionInput) {
  const payee = await findOrCreatePayeeByName(input.merchant);
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, balanceAsOf: true, note: true } });
    if (!wallet) throw new Error("Wallet not found.");
    await validateCategorySelection(tx, input.categoryId, input.subcategoryId);
    const plan = await buildInstallmentPlan(tx, input.walletId, input);
    const transaction = await tx.transaction.create({ data: { transactionDate: input.transactionDate, type: input.type, amount: input.amount, note: input.note ?? null, wallet: { connect: { id: input.walletId } }, ...(input.categoryId && { category: { connect: { id: input.categoryId } } }), ...(input.subcategoryId && { subcategory: { connect: { id: input.subcategoryId } } }), ...(payee && { payee: { connect: { id: payee.id } } }), ...(plan && { installmentPlan: { create: plan } }) }, include: { wallet: true, payee: true, category: true, subcategory: true, installmentPlan: true } });
    if (affectsCurrentBalance(transaction, wallet)) await applyBalanceDelta(tx, wallet.id, balanceDelta(transaction));
    return transaction;
  });
}

export async function updateTransactionService(id: string, input: UpdateTransactionInput) {
  const payee = await findOrCreatePayeeByName(input.merchant);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id }, include: { wallet: { select: { id: true, balanceAsOf: true, note: true } }, installmentPlan: true, splitBill: { select: { id: true } } } });
    if (!existing) throw new Error("Transaction not found.");
    if (existing.splitBill && (input.transactionDate !== undefined || input.type !== undefined || input.amount !== undefined || input.walletId !== undefined || input.installment !== undefined)) throw new Error("This transaction is linked to a Split Bill. Edit the Split Bill first, or remove the Split Bill before changing the transaction amount, date, wallet, type, or installment.");

    const newWalletId = input.walletId ?? existing.walletId;
    const newWallet = newWalletId === existing.wallet.id ? existing.wallet : await tx.wallet.findUnique({ where: { id: newWalletId }, select: { id: true, balanceAsOf: true, walletType: true, note: true } });
    if (!newWallet) throw new Error("Wallet not found.");
    const newCategoryId = input.categoryId !== undefined ? input.categoryId : existing.categoryId ?? undefined;
    const newSubcategoryId = input.subcategoryId !== undefined ? input.subcategoryId : existing.subcategoryId ?? undefined;
    await validateCategorySelection(tx, newCategoryId, newSubcategoryId);
    const oldTransaction: BalanceTransaction = { transactionDate: existing.transactionDate, type: existing.type, amount: existing.amount, createdAt: existing.createdAt };
    const newTransaction: BalanceTransaction = { transactionDate: input.transactionDate ?? existing.transactionDate, type: input.type ?? existing.type, amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : existing.amount, createdAt: existing.createdAt };

    if (input.installment?.enabled) {
      if (newTransaction.type !== TransactionType.EXPENSE) throw new Error("Installments are available for expense transactions only.");
      const tenor = input.installment.tenorMonths ?? existing.installmentPlan?.tenorMonths;
      if (!tenor || tenor < 2) throw new Error("Installment tenor is required.");
      const walletType = "walletType" in newWallet ? newWallet.walletType : (await tx.wallet.findUnique({ where: { id: newWallet.id }, select: { walletType: true } }))?.walletType;
      if (walletType !== WalletType.CREDIT_CARD) throw new Error("Installments are available for credit card transactions only.");
      const fee = new Prisma.Decimal(input.installment.feeAmount ?? existing.installmentPlan?.feeAmount ?? 0);
      const totalAmount = new Prisma.Decimal(newTransaction.amount).plus(fee);
      const startDate = input.installment.startDate ?? existing.installmentPlan?.startDate ?? newTransaction.transactionDate;
      const installmentAmount = totalAmount.div(tenor);
      const planData = { totalAmount, feeAmount: fee, installmentAmount, tenorMonths: tenor, startDate, status: "ACTIVE" as const };
      await tx.installmentPlan.upsert({ where: { transactionId: id }, create: { transactionId: id, ...planData }, update: planData });
    } else if (input.installment?.enabled === false && existing.installmentPlan) {
      await tx.installmentPlan.delete({ where: { transactionId: id } });
    }

    if (affectsCurrentBalance(oldTransaction, existing.wallet)) await applyBalanceDelta(tx, existing.wallet.id, balanceDelta(oldTransaction).negated());
    if (affectsCurrentBalance(newTransaction, newWallet)) await applyBalanceDelta(tx, newWallet.id, balanceDelta(newTransaction));

    return tx.transaction.update({ where: { id }, data: { ...(input.transactionDate && { transactionDate: input.transactionDate }), ...(input.type && { type: input.type }), ...(input.amount !== undefined && { amount: input.amount }), ...(input.note !== undefined && { note: input.note }), ...(input.walletId && { wallet: { connect: { id: input.walletId } } }), category: newCategoryId ? { connect: { id: newCategoryId } } : { disconnect: true }, subcategory: newSubcategoryId ? { connect: { id: newSubcategoryId } } : { disconnect: true }, ...(payee ? { payee: { connect: { id: payee.id } } } : { payee: { disconnect: true } }) }, include: { wallet: true, payee: true, category: true, subcategory: true, installmentPlan: true } });
  });
}

export async function deleteTransactionService(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id }, include: { wallet: { select: { id: true, balanceAsOf: true, note: true } }, splitBill: { select: { id: true } } } });
    if (!existing) throw new Error("Transaction not found.");
    if (existing.splitBill) throw new Error("This transaction is linked to a Split Bill. Delete the Split Bill first before deleting the transaction.");
    const transaction: BalanceTransaction = { transactionDate: existing.transactionDate, type: existing.type, amount: existing.amount, createdAt: existing.createdAt };
    if (affectsCurrentBalance(transaction, existing.wallet)) await applyBalanceDelta(tx, existing.wallet.id, balanceDelta(transaction).negated());
    return tx.transaction.delete({ where: { id } });
  });
}

export async function transactionFormData() {
  noStore();
  const [wallets, categories, subcategories, payees] = await Promise.all([
    prisma.wallet.findMany({ where: { isActive: true }, select: { id: true, name: true, walletType: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.subcategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.payee.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return { wallets, categories, subcategories, payees };
}
