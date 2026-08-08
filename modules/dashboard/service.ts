import {
  getActiveCurrencies,
  getDashboardCategories,
  getDashboardRecentTransactions,
  getDashboardSpending,
  getDashboardSummary,
  getDashboardWallets,
} from "./repository";
import type { DashboardData, DashboardFilters, DashboardPeriod } from "./types";

const DEFAULT_PERIOD: DashboardPeriod = "THIS_MONTH";
const DEFAULT_CURRENCY = "IDR";

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  THIS_MONTH: "This Month",
  LAST_MONTH: "Last Month",
  THIS_YEAR: "This Year",
};

export async function getDashboard(
  filters: DashboardFilters = {}
): Promise<DashboardData> {
  const period = filters.period ?? DEFAULT_PERIOD;
  const currencyCode = filters.currencyCode ?? DEFAULT_CURRENCY;

  const [summary, wallets, spending, recentTransactions] = await Promise.all([
    getDashboardSummary(period, currencyCode),
    getDashboardWallets(currencyCode),
    getDashboardSpending(period, currencyCode),
    getDashboardRecentTransactions(currencyCode),
  ]);

  const categoryIds = spending
    .map((item) => item.categoryId)
    .filter((id): id is string => id !== null);

  const categories = await getDashboardCategories(categoryIds);
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const totalSpending = spending.reduce(
    (sum, item) => sum + Number(item._sum.amount ?? 0),
    0
  );

  return {
    period,
    periodLabel: PERIOD_LABELS[period],
    summary: {
      currencyCode,
      currencySymbol: summary.currency?.symbol ?? currencyCode,
      netWorth: summary.netWorth,
      income: summary.income,
      expense: summary.expense,
      netCashFlow: summary.income - summary.expense,
    },
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      walletType: wallet.walletType,
      balance: Number(wallet.currentBalance),
      currencyCode: wallet.currency.code,
      currencySymbol: wallet.currency.symbol,
    })),
    spendingByCategory: spending.map((item) => {
      const amount = Number(item._sum.amount ?? 0);
      return {
        id: item.categoryId as string,
        name: categoryMap.get(item.categoryId as string) ?? "Uncategorized",
        amount,
        percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
      };
    }),
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
