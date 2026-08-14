import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const walletInclude = {
  currency: true,
  creditCard: true,
} satisfies Prisma.WalletInclude;

export type WalletWithRelations = Prisma.WalletGetPayload<{
  include: typeof walletInclude;
}>;

type WalletCreditCard = NonNullable<WalletWithRelations["creditCard"]>;

export type WalletClientData = Omit<WalletWithRelations, "currentBalance" | "creditCard"> & {
  currentBalance: string;
  creditCard: Omit<WalletCreditCard, "creditLimit" | "rewardPoint" | "annualFee"> & {
    creditLimit: string;
    rewardPoint: string;
    annualFee: string | null;
  } | null;
};

export type WalletHistoryEntry = {
  id: string;
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  kind: "TRANSACTION" | "TRANSFER";
};

export async function getWallets(): Promise<WalletWithRelations[]> {
  return prisma.wallet.findMany({
    include: walletInclude,
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getWalletById(id: string): Promise<WalletWithRelations | null> {
  return prisma.wallet.findUnique({ where: { id }, include: walletInclude });
}

export async function getWalletHistory(walletId: string): Promise<WalletHistoryEntry[]> {
  const [wallet, transactions, transfers] = await Promise.all([
    prisma.wallet.findUnique({ where: { id: walletId }, select: { currentBalance: true } }),
    prisma.transaction.findMany({
      where: { walletId },
      include: { payee: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.transfer.findMany({
      where: { OR: [{ fromWalletId: walletId }, { toWalletId: walletId }] },
      include: {
        fromWallet: { select: { name: true } },
        toWallet: { select: { name: true } },
        creditCardPayment: { select: { id: true } },
      },
      orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!wallet) return [];

  type Movement = { id: string; date: Date; createdAt: Date; description: string; delta: Prisma.Decimal; kind: "TRANSACTION" | "TRANSFER" };
  const movements: Movement[] = transactions.map((transaction) => ({
    id: `transaction-${transaction.id}`,
    date: transaction.transactionDate,
    createdAt: transaction.createdAt,
    description: transaction.payee?.name || transaction.category?.name || transaction.note || (transaction.type === "INCOME" ? "Income" : "Expense"),
    delta: transaction.type === "INCOME" ? transaction.amount : transaction.amount.negated(),
    kind: "TRANSACTION",
  }));

  for (const transfer of transfers) {
    const isOutgoing = transfer.fromWalletId === walletId;
    movements.push({
      id: `transfer-${transfer.id}`,
      date: transfer.transferDate,
      createdAt: transfer.createdAt,
      description: transfer.creditCardPayment
        ? (isOutgoing ? `Credit Card Payment → ${transfer.toWallet.name}` : `Credit Card Payment ← ${transfer.fromWallet.name}`)
        : (isOutgoing ? `Transfer → ${transfer.toWallet.name}` : `Transfer ← ${transfer.fromWallet.name}`),
      delta: isOutgoing ? transfer.amount.negated() : transfer.amount,
      kind: "TRANSFER",
    });
  }

  movements.sort((a, b) => {
    const dateDiff = b.date.getTime() - a.date.getTime();
    return dateDiff !== 0 ? dateDiff : b.createdAt.getTime() - a.createdAt.getTime();
  });

  let runningBalance = wallet.currentBalance;
  const result: WalletHistoryEntry[] = [];

  for (const movement of movements) {
    const balanceAfter = runningBalance;
    const debit = movement.delta.isNegative() ? movement.delta.abs() : new Prisma.Decimal(0);
    const credit = movement.delta.isPositive() ? movement.delta : new Prisma.Decimal(0);
    result.push({
      id: movement.id,
      date: movement.date.toISOString(),
      description: movement.description,
      debit: debit.toString(),
      credit: credit.toString(),
      balance: balanceAfter.toString(),
      kind: movement.kind,
    });
    runningBalance = runningBalance.minus(movement.delta);
  }

  return result;
}

export async function createWallet(data: Prisma.WalletCreateInput) {
  return prisma.wallet.create({ data, include: walletInclude });
}

export async function updateWallet(id: string, data: Prisma.WalletUpdateInput) {
  return prisma.wallet.update({ where: { id }, data, include: walletInclude });
}

export async function deleteWallet(id: string) {
  return prisma.wallet.update({ where: { id }, data: { isActive: false } });
}

export async function getActiveCurrencies() {
  return prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
}

export async function findCurrencyByCode(code: string) {
  return prisma.currency.findUnique({ where: { code } });
}
