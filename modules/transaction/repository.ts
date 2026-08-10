import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TransactionWithRelations = {
  id: string;
  transactionDate: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  note: string | null;
  walletId: string;
  categoryId: string | null;
  payeeId: string | null;
  wallet: {
    id: string;
    name: string;
    walletType: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT";
    currency: { id: string; code: string; name: string; symbol: string; decimalPlaces: number };
  };
  category: { id: string; name: string; type: "INCOME" | "EXPENSE"; icon: string | null; color: string | null } | null;
  payee: { id: string; name: string; note: string | null } | null;
  installmentPlan: { id: string; transactionId: string; totalAmount: string; feeAmount: string; installmentAmount: string; tenorMonths: number; startDate: string; status: "ACTIVE" | "COMPLETED" | "CANCELLED" } | null;
  splitBill: { id: string; totalAmount: string; personalAmount: string; status: "OPEN" | "SETTLED" | "CANCELLED" } | null;
};

type RawTransaction = Prisma.TransactionGetPayload<{ include: { wallet: { include: { currency: true } }; category: true; payee: true; installmentPlan: true; splitBill: true } }>;

function serializeTransaction(transaction: RawTransaction): TransactionWithRelations {
  return {
    id: transaction.id,
    transactionDate: transaction.transactionDate.toISOString(),
    type: transaction.type,
    amount: transaction.amount.toString(),
    note: transaction.note,
    walletId: transaction.walletId,
    categoryId: transaction.categoryId,
    payeeId: transaction.payeeId,
    wallet: { id: transaction.wallet.id, name: transaction.wallet.name, walletType: transaction.wallet.walletType, currency: { id: transaction.wallet.currency.id, code: transaction.wallet.currency.code, name: transaction.wallet.currency.name, symbol: transaction.wallet.currency.symbol, decimalPlaces: transaction.wallet.currency.decimalPlaces } },
    category: transaction.category ? { id: transaction.category.id, name: transaction.category.name, type: transaction.category.type, icon: transaction.category.icon, color: transaction.category.color } : null,
    payee: transaction.payee ? { id: transaction.payee.id, name: transaction.payee.name, note: transaction.payee.note } : null,
    installmentPlan: transaction.installmentPlan ? { id: transaction.installmentPlan.id, transactionId: transaction.installmentPlan.transactionId, totalAmount: transaction.installmentPlan.totalAmount.toString(), feeAmount: transaction.installmentPlan.feeAmount.toString(), installmentAmount: transaction.installmentPlan.installmentAmount.toString(), tenorMonths: transaction.installmentPlan.tenorMonths, startDate: transaction.installmentPlan.startDate.toISOString(), status: transaction.installmentPlan.status } : null,
    splitBill: transaction.splitBill ? { id: transaction.splitBill.id, totalAmount: transaction.splitBill.totalAmount.toString(), personalAmount: transaction.splitBill.personalAmount.toString(), status: transaction.splitBill.status } : null,
  };
}

export async function getTransactions() {
  const transactions = await prisma.transaction.findMany({ where: { kind: "STANDARD" }, include: { wallet: { include: { currency: true } }, category: true, payee: true, installmentPlan: true, splitBill: true }, orderBy: { transactionDate: "desc" } });
  return transactions.map(serializeTransaction);
}

export async function getTransactionById(id: string) {
  const transaction = await prisma.transaction.findFirst({ where: { id, kind: "STANDARD" }, include: { wallet: { include: { currency: true } }, category: true, payee: true, installmentPlan: true, splitBill: true } });
  return transaction ? serializeTransaction(transaction) : null;
}

export async function createTransaction(data: Prisma.TransactionCreateInput) { return prisma.transaction.create({ data }); }
export async function updateTransaction(id: string, data: Prisma.TransactionUpdateInput) { return prisma.transaction.update({ where: { id }, data }); }
export async function deleteTransaction(id: string) { return prisma.transaction.delete({ where: { id } }); }
