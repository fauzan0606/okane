import { prisma } from "@/lib/prisma";
import {
  getActiveCurrencies,
  getDashboardCategories,
  getDashboardCashflow,
  getDashboardRecentTransactions,
  getDashboardSpending,
  getDashboardSummary,
  getDashboardWallets,
  getPeriodRange,
} from "./repository";
import type { DashboardCashflowPoint, DashboardData, DashboardFilters, DashboardPeriod } from "./types";

const DEFAULT_PERIOD: DashboardPeriod = "THIS_MONTH";
const DEFAULT_CURRENCY = "IDR";

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  THIS_MONTH: "This Month",
  LAST_MONTH: "Last Month",
  THIS_YEAR: "This Year",
};

function buildCashflowPoints(
  period: DashboardPeriod,
  transactions: Array<{ transactionDate: Date; type: "INCOME" | "EXPENSE"; amount: unknown }>
): DashboardCashflowPoint[] {
  const pointCount = period === "THIS_YEAR" ? 12 : 5;
  const now = new Date();
  const labels = period === "THIS_YEAR"
    ? Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(now.getFullYear(), index, 1)))
    : ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];

  const points = labels.map((label) => ({ label, income: 0, expense: 0 }));

  for (const transaction of transactions) {
    const date = transaction.transactionDate;
    const index = period === "THIS_YEAR"
      ? date.getMonth()
      : Math.min(Math.floor((date.getDate() - 1) / 7), pointCount - 1);

    if (transaction.type === "INCOME") points[index].income += Number(transaction.amount);
    if (transaction.type === "EXPENSE") points[index].expense += Number(transaction.amount);
  }

  return points;
}

export async function getDashboard(filters: DashboardFilters = {}): Promise<DashboardData> {
  const period = filters.period ?? DEFAULT_PERIOD;
  const currencyCode = filters.currencyCode ?? DEFAULT_CURRENCY;
  const { start, end } = getPeriodRange(period);

  const [summary, wallets, spending, recentTransactions, cashflowTransactions, splitTransactions] = await Promise.all([
    getDashboardSummary(period, currencyCode),
    getDashboardWallets(currencyCode),
    getDashboardSpending(period, currencyCode),
    getDashboardRecentTransactions(currencyCode),
    getDashboardCashflow(period, currencyCode),
    prisma.transaction.findMany({
      where: { kind: "STANDARD", type: "EXPENSE", transactionDate: { gte: start, lt: end }, wallet: { currency: { code: currencyCode } }, splitBill: { isNot: null } },
      select: { categoryId: true, amount: true, splitBill: { select: { personalAmount: true } } },
    }),
  ]);

  const splitFullAmount = splitTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const splitPersonalAmount = splitTransactions.reduce((sum, transaction) => sum + Number(transaction.splitBill?.personalAmount ?? 0), 0);
  const personalExpense = Math.max(summary.expense - (splitFullAmount - splitPersonalAmount), 0);

  const spendingMap = new Map<string | null, number>();
  spending.forEach((item) => spendingMap.set(item.categoryId, Number(item._sum.amount ?? 0)));
  splitTransactions.forEach((transaction) => {
    const full = Number(transaction.amount);
    const personal = Number(transaction.splitBill?.personalAmount ?? 0);
    spendingMap.set(transaction.categoryId, (spendingMap.get(transaction.categoryId) ?? 0) - full + personal);
  });
  const adjustedSpending = [...spendingMap.entries()].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]).map(([categoryId, amount]) => ({ categoryId, _sum: { amount } }));

  const categoryIds = adjustedSpending
    .map((item) => item.categoryId)
    .filter((id): id is string => id !== null);

  const categories = await getDashboardCategories(categoryIds);
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const totalSpending = adjustedSpending.reduce((sum, item) => sum + Number(item._sum.amount ?? 0), 0);

  return {
    period,
    periodLabel: PERIOD_LABELS[period],
    summary: {
      currencyCode,
      currencySymbol: summary.currency?.symbol ?? currencyCode,
      netWorth: summary.netWorth,
      income: summary.income,
      expense: personalExpense,
      netCashFlow: summary.income - personalExpense,
    },
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      walletType: wallet.walletType,
      balance: Number(wallet.currentBalance),
      currencyCode: wallet.currency.code,
      currencySymbol: wallet.currency.symbol,
    })),
    spendingByCategory: adjustedSpending.map((item) => {
      const amount = Number(item._sum.amount ?? 0);
      return {
        id: item.categoryId as string,
        name: categoryMap.get(item.categoryId as string) ?? "Uncategorized",
        amount,
        percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
      };
    }),
    cashflow: buildCashflowPoints(period, cashflowTransactions),
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      transactionDate: transaction.transactionDate,
      type: transaction.type,
      amount: Number(transaction.amount),
      payeeName: transaction.payee?.name ?? "Unknown",
      categoryName: transaction.category?.name ?? "Uncategorized",
      walletName: transaction.wallet.name,
    })),
  };
}

export async function listDashboardCurrencies() {
  return getActiveCurrencies();
}
