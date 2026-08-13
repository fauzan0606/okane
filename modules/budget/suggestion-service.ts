import { prisma } from "@/lib/prisma";
import type { BudgetSuggestion } from "./types";

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Month must use YYYY-MM format.");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Invalid month.");
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}

function shiftMonth(month: string, delta: number) {
  const { start } = monthBounds(month);
  start.setMonth(start.getMonth() + delta);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
}

function historicalMonths(month: string, count = 6) {
  return Array.from({ length: count }, (_, index) => shiftMonth(month, -(index + 1)));
}

function roundBudget(value: number) {
  return Math.max(Math.round(value / 1000) * 1000, 0);
}

async function monthExpenseStats(month: string, currencyId: string) {
  const { start, end } = monthBounds(month);
  const [expenses, income] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        kind: "STANDARD",
        type: "EXPENSE",
        transactionDate: { gte: start, lt: end },
        wallet: { currencyId },
      },
      select: { amount: true, categoryId: true, subcategoryId: true },
    }),
    prisma.transaction.aggregate({
      where: {
        kind: "STANDARD",
        type: "INCOME",
        transactionDate: { gte: start, lt: end },
        wallet: { currencyId },
      },
      _sum: { amount: true },
    }),
  ]);
  return { expenses, income: Number(income._sum.amount ?? 0) };
}

export async function getBudgetSuggestionV2(month: string, currencyCode: string): Promise<BudgetSuggestion> {
  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
  if (!currency) throw new Error("Currency not found.");
  const historyMonths = historicalMonths(month);
  const current = await monthExpenseStats(month, currency.id);
  const [history, previousBudget, categories] = await Promise.all([
    Promise.all(historyMonths.map((item) => monthExpenseStats(item, currency.id))),
    (async () => {
      const previousMonth = shiftMonth(month, -1);
      const bounds = monthBounds(previousMonth);
      return prisma.budget.findUnique({
        where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: bounds.start, periodEnd: bounds.end } },
        include: { items: true },
      });
    })(),
    prisma.category.findMany({
      where: { isActive: true, type: "EXPENSE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const incomeValues = [...history.map((item) => item.income), current.income].filter((value) => value > 0);
  const expenseValues = [...history.map((item) => item.expenses.reduce((sum, tx) => sum + Number(tx.amount), 0)), current.expenses.reduce((sum, tx) => sum + Number(tx.amount), 0)].filter((value) => value > 0);
  const incomeEstimate = incomeValues.length ? incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length : 0;
  const historicalExpenseAverage = expenseValues.length ? expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length : 0;
  const previousBudgetTotal = previousBudget?.totalAmount?.toNumber() ?? previousBudget?.items.reduce((sum, item) => sum + item.amount.toNumber(), 0) ?? 0;
  const recommendedTotalBudget = roundBudget(Math.min(
    incomeEstimate > 0 ? incomeEstimate * 0.8 : historicalExpenseAverage * 1.05,
    Math.max(historicalExpenseAverage * 1.03, previousBudgetTotal * 0.98),
  ));

  const categoryMap = new Map<string, { historical: number[]; current: number; previous: number }>();
  for (const category of categories) categoryMap.set(category.id, { historical: [], current: 0, previous: 0 });
  for (const stats of history) for (const tx of stats.expenses) {
    if (!tx.categoryId) continue;
    const entry = categoryMap.get(tx.categoryId);
    if (entry) entry.historical.push(Number(tx.amount));
  }
  for (const tx of current.expenses) {
    if (!tx.categoryId) continue;
    const entry = categoryMap.get(tx.categoryId);
    if (entry) entry.current += Number(tx.amount);
  }
  for (const item of previousBudget?.items ?? []) {
    if (!item.categoryId) continue;
    const entry = categoryMap.get(item.categoryId);
    if (entry) entry.previous += item.amount.toNumber();
  }

  const raw = categories.map((category) => {
    const entry = categoryMap.get(category.id)!;
    const historicalAverage = entry.historical.length ? entry.historical.reduce((a, b) => a + b, 0) / entry.historical.length : 0;
    const recommended = historicalAverage * 0.55 + entry.current * 0.15 + entry.previous * 0.30;
    return { categoryId: category.id, categoryName: category.name, subcategoryId: null, subcategoryName: null, recommendedAmountRaw: recommended, historicalAverage, previousBudget: entry.previous };
  });

  const positiveTotal = raw.reduce((sum, item) => sum + item.recommendedAmountRaw, 0);
  const scale = positiveTotal > 0 && recommendedTotalBudget > 0 ? Math.min(1, recommendedTotalBudget / positiveTotal) : 1;
  const items = raw.map((item) => ({
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    subcategoryId: item.subcategoryId,
    subcategoryName: item.subcategoryName,
    recommendedAmount: roundBudget(item.recommendedAmountRaw * scale),
    historicalAverage: roundBudget(item.historicalAverage),
    previousBudget: roundBudget(item.previousBudget),
  }));

  const coverage = history.filter((item) => item.expenses.length > 0).length;
  return { month, currencyCode, incomeEstimate: roundBudget(incomeEstimate), historicalExpenseAverage: roundBudget(historicalExpenseAverage), previousBudgetTotal: roundBudget(previousBudgetTotal), recommendedTotalBudget, confidence: coverage >= 5 ? "HIGH" : coverage >= 3 ? "MEDIUM" : "LOW", items };
}
