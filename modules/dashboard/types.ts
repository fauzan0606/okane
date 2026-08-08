import { TransactionType } from "@prisma/client";

export type DashboardPeriod = "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR";

export type DashboardFilters = {
  period?: DashboardPeriod;
  currencyCode?: string;
};

export type DashboardSummary = {
  currencyCode: string;
  currencySymbol: string;
  netWorth: number;
  income: number;
  expense: number;
  netCashFlow: number;
};

export type DashboardWallet = {
  id: string;
  name: string;
  walletType: string;
  balance: number;
  currencyCode: string;
  currencySymbol: string;
};

export type DashboardCategory = {
  id: string;
  name: string;
  amount: number;
  percentage: number;
};

export type DashboardTransaction = {
  id: string;
  transactionDate: Date;
  type: TransactionType;
  amount: number;
  payeeName: string;
  categoryName: string;
  walletName: string;
};

export type DashboardData = {
  period: DashboardPeriod;
  periodLabel: string;
  summary: DashboardSummary;
  wallets: DashboardWallet[];
  spendingByCategory: DashboardCategory[];
  recentTransactions: DashboardTransaction[];
};
