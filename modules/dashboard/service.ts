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
import { getBudgetOverview } from "@/modules/budget/service";
import type { DashboardAiAssessment, DashboardCalendar, DashboardCashflowPoint, DashboardData, DashboardFilters, DashboardPeriod } from "./types";

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

function buildCalendar(now = new Date(), transactions: Array<{ transactionDate: Date; type: "INCOME" | "EXPENSE"; amount: unknown }>): DashboardCalendar {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daily = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    income: 0,
    expense: 0,
    transactionCount: 0,
    isToday: index + 1 === now.getDate(),
  }));

  for (const transaction of transactions) {
    const day = transaction.transactionDate.getDate();
    const target = daily[day - 1];
    if (!target) continue;
    target.transactionCount += 1;
    if (transaction.type === "INCOME") target.income += Number(transaction.amount);
    if (transaction.type === "EXPENSE") target.expense += Number(transaction.amount);
  }

  return {
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, monthIndex, 1)),
    daysInMonth,
    firstWeekday,
    days: daily,
  };
}

function buildAiAssessment(input: { income: number; expense: number; netCashFlow: number; budgetUsed: number; budgetTotal: number; unbudgeted: number }): DashboardAiAssessment {
  let score = 100;
  const insights: string[] = [];

  if (input.income <= 0) {
    score -= 35;
    insights.push("Belum ada pemasukan tercatat pada periode ini.");
  } else if (input.netCashFlow < 0) {
    score -= 30;
    insights.push("Pengeluaran lebih besar daripada pemasukan pada periode ini.");
  } else if (input.netCashFlow < input.income * 0.1) {
    score -= 12;
    insights.push("Arus kas masih positif, tetapi ruang aman bulan ini relatif tipis.");
  } else {
    insights.push("Arus kas masih positif berdasarkan transaksi yang tercatat.");
  }

  if (input.budgetTotal > 0) {
    const ratio = input.budgetUsed / input.budgetTotal;
    if (ratio > 1) {
      score -= 25;
      insights.push(`Realisasi pengeluaran sudah ${Math.round(ratio * 100)}% dari budget bulan berjalan.`);
    } else if (ratio >= 0.8) {
      score -= 10;
      insights.push(`Penggunaan budget sudah ${Math.round(ratio * 100)}%; perlu menjaga pengeluaran hingga akhir bulan.`);
    } else {
      insights.push(`Penggunaan budget masih ${Math.round(ratio * 100)}%; posisi masih relatif terkendali.`);
    }
  } else {
    score -= 8;
    insights.push("Belum ada budget bulan berjalan, sehingga kontrol pengeluaran belum memiliki target.");
  }

  if (input.unbudgeted > 0) {
    score -= 8;
    insights.push(`Ada ${input.unbudgeted.toLocaleString("id-ID")} pengeluaran yang belum tercakup budget kategori.`);
  }

  score = Math.max(0, Math.min(100, score));
  const status: DashboardAiAssessment["status"] = score >= 75 ? "HEALTHY" : score >= 50 ? "WATCH" : "AT_RISK";
  const headline = status === "HEALTHY"
    ? "Kondisi keuangan saat ini terlihat cukup sehat."
    : status === "WATCH"
      ? "Kondisi keuangan masih terkendali, tetapi ada beberapa hal yang perlu diperhatikan."
      : "Ada beberapa indikator yang perlu segera diperhatikan agar kondisi keuangan tidak memburuk.";

  return { score, status, headline, insights: insights.slice(0, 4) };
}

export async function getDashboard(filters: DashboardFilters = {}): Promise<DashboardData> {
  const period = filters.period ?? DEFAULT_PERIOD;
  const currencyCode = filters.currencyCode ?? DEFAULT_CURRENCY;
  const { start, end } = getPeriodRange(period);
  const now = new Date();
  const calendarStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const calendarEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [summary, wallets, spending, recentTransactions, cashflowTransactions, splitTransactions, budgetOverview, calendarTransactions] = await Promise.all([
    getDashboardSummary(period, currencyCode),
    getDashboardWallets(currencyCode),
    getDashboardSpending(period, currencyCode),
    getDashboardRecentTransactions(currencyCode),
    getDashboardCashflow(period, currencyCode),
    prisma.transaction.findMany({
      where: { kind: "STANDARD", type: "EXPENSE", transactionDate: { gte: start, lt: end }, wallet: { currency: { code: currencyCode } }, splitBill: { isNot: null } },
      select: { categoryId: true, amount: true, splitBill: { select: { personalAmount: true } } },
    }),
    getBudgetOverview(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, currencyCode),
    prisma.transaction.findMany({
      where: { kind: "STANDARD", type: { in: ["INCOME", "EXPENSE"] }, transactionDate: { gte: calendarStart, lt: calendarEnd }, wallet: { currency: { code: currencyCode } } },
      select: { transactionDate: true, type: true, amount: true },
      orderBy: { transactionDate: "asc" },
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
  const budgetUsed = budgetOverview.totalActual;
  const aiAssessment = buildAiAssessment({
    income: summary.income,
    expense: personalExpense,
    netCashFlow: summary.income - personalExpense,
    budgetUsed,
    budgetTotal: budgetOverview.totalBudget,
    unbudgeted: budgetOverview.unbudgetedActual,
  });

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
    budget: {
      hasBudget: budgetOverview.mode !== "NONE",
      mode: budgetOverview.mode,
      totalBudget: budgetOverview.totalBudget,
      actualUsed: budgetUsed,
      remaining: budgetOverview.totalRemaining,
      progressPercentage: budgetOverview.totalBudget > 0 ? Math.min((budgetUsed / budgetOverview.totalBudget) * 100, 100) : 0,
    },
    aiAssessment,
    calendar: buildCalendar(now, calendarTransactions),
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
