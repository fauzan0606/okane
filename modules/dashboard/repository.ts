import { prisma } from "@/lib/prisma";
import type { DashboardPeriod } from "./types";

function getPeriodRange(period: DashboardPeriod, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "LAST_MONTH") {
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 1),
    };
  }

  if (period === "THIS_YEAR") {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year + 1, 0, 1),
    };
  }

  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
}

export async function getDashboardSummary(
  period: DashboardPeriod,
  currencyCode: string
) {
  const { start, end } = getPeriodRange(period);

  const [currency, wallets, income, expense] = await Promise.all([
    prisma.currency.findUnique({ where: { code: currencyCode } }),
    prisma.wallet.findMany({
      where: { isActive: true, currency: { code: currencyCode } },
      select: { currentBalance: true },
    }),
    prisma.transaction.aggregate({
      where: {
        type: "INCOME",
        transactionDate: { gte: start, lt: end },
        wallet: { currency: { code: currencyCode } },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        type: "EXPENSE",
        transactionDate: { gte: start, lt: end },
        wallet: { currency: { code: currencyCode } },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    currency,
    netWorth: wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance), 0),
    income: Number(income._sum.amount ?? 0),
    expense: Number(expense._sum.amount ?? 0),
  };
}

export async function getDashboardWallets(currencyCode: string) {
  return prisma.wallet.findMany({
    where: { isActive: true, currency: { code: currencyCode } },
    select: {
      id: true,
      name: true,
      walletType: true,
      currentBalance: true,
      currency: { select: { code: true, symbol: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getDashboardSpending(
  period: DashboardPeriod,
  currencyCode: string
) {
  const { start, end } = getPeriodRange(period);

  return prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      type: "EXPENSE",
      transactionDate: { gte: start, lt: end },
      wallet: { currency: { code: currencyCode } },
      categoryId: { not: null },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });
}

export async function getDashboardCategories(categoryIds: string[]) {
  if (categoryIds.length === 0) return [];

  return prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
}

export async function getDashboardRecentTransactions(
  currencyCode: string
) {
  return prisma.transaction.findMany({
    where: { wallet: { currency: { code: currencyCode } } },
    take: 10,
    orderBy: { transactionDate: "desc" },
    select: {
      id: true,
      transactionDate: true,
      type: true,
      amount: true,
      wallet: { select: { name: true } },
      category: { select: { name: true } },
      payee: { select: { name: true } },
    },
  });
}

export async function getActiveCurrencies() {
  return prisma.currency.findMany({
    where: { isActive: true },
    select: { code: true, symbol: true, name: true },
    orderBy: { code: "asc" },
  });
}
