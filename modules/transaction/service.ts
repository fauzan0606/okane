import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  getTransactionById,
  getTransactions,
} from "./repository";

import { findOrCreatePayeeByName } from "@/modules/payee/service";

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

type BalanceTransaction = {
  transactionDate: Date;
  type: "INCOME" | "EXPENSE";
  amount: Prisma.Decimal;
  createdAt: Date;
};

type BalanceWallet = {
  balanceAsOf: Date | null;
};

/**
 * A manually confirmed wallet balance is a snapshot of the real balance.
 * Transactions dated before the snapshot are already included in that
 * balance. Transactions after the snapshot affect the balance.
 *
 * Transaction forms currently capture a calendar date rather than a time.
 * For transactions on the same calendar day as the snapshot, createdAt is
 * used to distinguish records entered after the snapshot.
 */
function affectsCurrentBalance(
  transaction: BalanceTransaction,
  wallet: BalanceWallet
) {
  const snapshot = wallet.balanceAsOf;

  if (!snapshot) {
    return true;
  }

  const transactionDay = Date.UTC(
    transaction.transactionDate.getUTCFullYear(),
    transaction.transactionDate.getUTCMonth(),
    transaction.transactionDate.getUTCDate()
  );
  const snapshotDay = Date.UTC(
    snapshot.getUTCFullYear(),
    snapshot.getUTCMonth(),
    snapshot.getUTCDate()
  );

  if (transactionDay > snapshotDay) {
    return true;
  }

  if (transactionDay < snapshotDay) {
    return false;
  }

  return transaction.createdAt > snapshot;
}

function balanceDelta(transaction: BalanceTransaction) {
  return transaction.type === "INCOME"
    ? transaction.amount
    : transaction.amount.negated();
}

async function applyBalanceDelta(
  tx: Prisma.TransactionClient,
  walletId: string,
  delta: Prisma.Decimal
) {
  if (delta.isZero()) {
    return;
  }

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      currentBalance: delta.isPositive()
        ? { increment: delta }
        : { decrement: delta.abs() },
    },
  });
}

export async function createTransactionService(
  input: CreateTransactionInput
) {
  const payee = await findOrCreatePayeeByName(input.merchant);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { id: input.walletId },
      select: { id: true, balanceAsOf: true },
    });

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const transaction = await tx.transaction.create({
      data: {
        transactionDate: input.transactionDate,
        type: input.type,
        amount: input.amount,
        note: input.note ?? null,
        wallet: { connect: { id: input.walletId } },
        ...(input.categoryId && {
          category: { connect: { id: input.categoryId } },
        }),
        ...(payee && {
          payee: { connect: { id: payee.id } },
        }),
      },
    });

    if (
      affectsCurrentBalance(
        transaction,
        wallet
      )
    ) {
      await applyBalanceDelta(tx, wallet.id, balanceDelta(transaction));
    }

    return transaction;
  });
}

export async function updateTransactionService(
  id: string,
  input: UpdateTransactionInput
) {
  const payee = await findOrCreatePayeeByName(input.merchant);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({
      where: { id },
      include: {
        wallet: {
          select: {
            id: true,
            balanceAsOf: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Transaction not found.");
    }

    const newWalletId = input.walletId ?? existing.walletId;
    const newWallet =
      newWalletId === existing.wallet.id
        ? existing.wallet
        : await tx.wallet.findUnique({
            where: { id: newWalletId },
            select: { id: true, balanceAsOf: true },
          });

    if (!newWallet) {
      throw new Error("Wallet not found.");
    }

    const oldTransaction: BalanceTransaction = {
      transactionDate: existing.transactionDate,
      type: existing.type,
      amount: existing.amount,
      createdAt: existing.createdAt,
    };

    const newTransaction: BalanceTransaction = {
      transactionDate: input.transactionDate ?? existing.transactionDate,
      type: input.type ?? existing.type,
      amount:
        input.amount !== undefined
          ? new Prisma.Decimal(input.amount)
          : existing.amount,
      createdAt: existing.createdAt,
    };

    if (affectsCurrentBalance(oldTransaction, existing.wallet)) {
      await applyBalanceDelta(
        tx,
        existing.wallet.id,
        balanceDelta(oldTransaction).negated()
      );
    }

    if (affectsCurrentBalance(newTransaction, newWallet)) {
      await applyBalanceDelta(
        tx,
        newWallet.id,
        balanceDelta(newTransaction)
      );
    }

    return tx.transaction.update({
      where: { id },
      data: {
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
          wallet: { connect: { id: input.walletId } },
        }),
        ...(input.categoryId && {
          category: { connect: { id: input.categoryId } },
        }),
        ...(payee && {
          payee: { connect: { id: payee.id } },
        }),
      },
    });
  });
}

export async function deleteTransactionService(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({
      where: { id },
      include: {
        wallet: {
          select: {
            id: true,
            balanceAsOf: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Transaction not found.");
    }

    const transaction: BalanceTransaction = {
      transactionDate: existing.transactionDate,
      type: existing.type,
      amount: existing.amount,
      createdAt: existing.createdAt,
    };

    if (affectsCurrentBalance(transaction, existing.wallet)) {
      await applyBalanceDelta(
        tx,
        existing.wallet.id,
        balanceDelta(transaction).negated()
      );
    }

    return tx.transaction.delete({ where: { id } });
  });
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
