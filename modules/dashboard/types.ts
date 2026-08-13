import type { TransactionType } from "@prisma/client";

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

export type DashboardBudget = {
  hasBudget: boolean;
  mode: "NONE" | "OVERALL" | "CATEGORY";
  totalBudget: number;
  actualUsed: number;
  remaining: number;
  progressPercentage: number;
};

export type DashboardAiAssessment = {
  score: number;
  status: "HEALTHY" | "WATCH" | "AT_RISK";
  headline: string;
  insights: string[];
};

export type DashboardCalendarDay = {
  day: number;
  income: number;
  expense: number;
  transactionCount: number;
  isToday: boolean;
};

export type DashboardCalendar = {
  month: string;
  label: string;
  daysInMonth: number;
  firstWeekday: number;
  days: DashboardCalendarDay[];
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

export type DashboardCashflowPoint = {
  label: string;
  income: number;
  expense: number;
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
  budget: DashboardBudget;
  aiAssessment: DashboardAiAssessment;
  calendar: DashboardCalendar;
  wallets: DashboardWallet[];
  spendingByCategory: DashboardCategory[];
  cashflow: DashboardCashflowPoint[];
  recentTransactions: DashboardTransaction[];
};
