import { prisma } from "@/lib/prisma";

import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
} from "./repository";

import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "./types";

export async function listTransactions() {
  return getTransactions();
}

export async function findTransaction(id: string) {
  return getTransactionById(id);
}

export async function createTransactionService(
  input: CreateTransactionInput
) {
  return createTransaction({
    transactionDate: input.transactionDate,
    type: input.type,
    amount: input.amount,

    note: input.note ?? null,

    wallet: {
      connect: {
        id: input.walletId,
      },
    },

    ...(input.categoryId && {
      category: {
        connect: {
          id: input.categoryId,
        },
      },
    }),

    ...(input.payeeId && {
      payee: {
        connect: {
          id: input.payeeId,
        },
      },
    }),
  });
}

export async function updateTransactionService(
  id: string,
  input: UpdateTransactionInput
) {
  return updateTransaction(id, {
    ...(input.transactionDate && {
      transactionDate: input.transactionDate,
    }),

    ...(input.type && {
      type: input.type,
    }),

    ...(input.amount !== undefined && {
      amount: input.amount,
    }),

    ...(input.note !== undefined && {
      note: input.note,
    }),

    ...(input.walletId && {
      wallet: {
        connect: {
          id: input.walletId,
        },
      },
    }),

    ...(input.categoryId && {
      category: {
        connect: {
          id: input.categoryId,
        },
      },
    }),

    ...(input.payeeId && {
      payee: {
        connect: {
          id: input.payeeId,
        },
      },
    }),
  });
}

export async function deleteTransactionService(id: string) {
  return deleteTransaction(id);
}

export async function transactionFormData() {
  const [wallets, categories, payees] = await Promise.all([
    prisma.wallet.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.payee.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    wallets,
    categories,
    payees,
  };
}