import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type TransactionWithRelations =
  Prisma.TransactionGetPayload<{
    include: {
      wallet: {
        include: {
          currency: true;
        };
      };
      category: true;
      payee: true;
    };
  }>;

export async function getTransactions() {
  return prisma.transaction.findMany({
    where: {},
    include: {
      wallet: {
        include: {
          currency: true,
        },
      },
      category: true,
      payee: true,
    },
    orderBy: {
      transactionDate: "desc",
    },
  });
}

export async function getTransactionById(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      wallet: {
        include: {
          currency: true,
        },
      },
      category: true,
      payee: true,
    },
  });
}

export async function createTransaction(
  data: Prisma.TransactionCreateInput
) {
  return prisma.transaction.create({
    data,
  });
}

export async function updateTransaction(
  id: string,
  data: Prisma.TransactionUpdateInput
) {
  return prisma.transaction.update({
    where: { id },
    data,
  });
}

export async function deleteTransaction(id: string) {
  return prisma.transaction.delete({
    where: { id },
  });
}