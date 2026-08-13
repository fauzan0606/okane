import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BudgetOverview, BudgetSuggestion } from "./types";

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Month must use YYYY-MM format.");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Invalid month.");
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}
function shiftMonth(month: string, delta: number) { const { start } = monthBounds(month); start.setMonth(start.getMonth() + delta); return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`; }
export function currentMonthKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(month: string) { const { start } = monthBounds(month); return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(start); }

export async function getBudgetOverview(month = currentMonthKey(), currencyCode = "IDR"): Promise<BudgetOverview> {
  const { start, end } = monthBounds(month);
  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
  if (!currency) throw new Error(`Currency ${currencyCode} not found.`);
  const budget = await prisma.budget.upsert({ where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } }, create: { name: `Budget ${monthLabel(month)}`, currencyId: currency.id, periodStart: start, periodEnd: end }, update: {}, include: { items: { include: { category: true, subcategory: true }, orderBy: [{ createdAt: "asc" }] } } });
  const [transactions, incomeTransactions] = await Promise.all([
    prisma.transaction.findMany({ where: { kind: "STANDARD", type: "EXPENSE", transactionDate: { gte: start, lt: end }, wallet: { currencyId: currency.id } }, select: { amount: true, categoryId: true, subcategoryId: true } }),
    prisma.transaction.findMany({ where: { kind: "STANDARD", type: "INCOME", transactionDate: { gte: start, lt: end }, wallet: { currencyId: currency.id } }, select: { amount: true } }),
  ]);
  const totalActual = transactions.reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));
  const totalIncome = incomeTransactions.reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));
  const overallBudgetAmount = budget.totalAmount?.toNumber() ?? null;
  const items = budget.items.map((item) => {
    const actual = transactions.filter((transaction) => item.subcategoryId ? transaction.subcategoryId === item.subcategoryId : item.categoryId ? transaction.categoryId === item.categoryId : false).reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));
    const budgetAmount = item.amount;
    const remaining = budgetAmount.minus(actual);
    return { id: item.id, categoryId: item.categoryId, categoryName: item.category?.name ?? null, subcategoryId: item.subcategoryId, subcategoryName: item.subcategory?.name ?? null, amount: budgetAmount.toNumber(), actualAmount: actual.toNumber(), remainingAmount: remaining.toNumber(), percentage: budgetAmount.gt(0) ? actual.div(budgetAmount).mul(100).toNumber() : 0 };
  });
  const totalBudget = overallBudgetAmount ?? items.reduce((sum, item) => sum + item.amount, 0);
  const budgetedActual = overallBudgetAmount !== null ? totalActual.toNumber() : items.reduce((sum, item) => sum + item.actualAmount, 0);
  const totalRemaining = totalBudget - budgetedActual;
  const unbudgetedActual = overallBudgetAmount !== null ? 0 : Math.max(totalActual.toNumber() - budgetedActual, 0);
  const recommendedTotalBudget = await recommendTotalBudget(month, currency.id, totalIncome.toNumber(), totalActual.toNumber());
  const mode: BudgetOverview["mode"] = overallBudgetAmount !== null ? "OVERALL" : items.length > 0 ? "CATEGORY" : "NONE";
  return { budgetId: budget.id, name: budget.name, month, mode, currency: { id: currency.id, code: currency.code, name: currency.name, symbol: currency.symbol, decimalPlaces: currency.decimalPlaces }, totalBudget, totalActual: totalActual.toNumber(), totalRemaining, unbudgetedActual, incomeEstimate: totalIncome.toNumber(), recommendedTotalBudget, items };
}

export async function getBudgetFormData(currencyCode = "IDR") {
  const [currencies, categories, subcategories] = await Promise.all([
    prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, symbol: true, decimalPlaces: true } }),
    prisma.category.findMany({ where: { isActive: true, type: "EXPENSE" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.subcategory.findMany({ where: { isActive: true, category: { type: "EXPENSE" } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, categoryId: true, name: true } }),
  ]);
  return { currencies, categories, subcategories, selectedCurrency: currencies.find((currency) => currency.code === currencyCode)?.code ?? currencies[0]?.code ?? currencyCode };
}

export async function upsertOverallBudget(input: { month: string; currencyCode: string; amount: number }) {
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("Overall budget cannot be negative.");
  const { start, end } = monthBounds(input.month);
  const currency = await prisma.currency.findUnique({ where: { code: input.currencyCode } });
  if (!currency) throw new Error("Currency not found.");
  return prisma.budget.upsert({ where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } }, create: { name: `Budget ${monthLabel(input.month)}`, currencyId: currency.id, periodStart: start, periodEnd: end, totalAmount: input.amount }, update: { totalAmount: input.amount } });
}

export async function upsertBudgetItem(input: { month: string; currencyCode: string; categoryId: string; subcategoryId?: string; amount: number }) {
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("Budget amount cannot be negative.");
  const { start, end } = monthBounds(input.month);
  const currency = await prisma.currency.findUnique({ where: { code: input.currencyCode } });
  if (!currency) throw new Error("Currency not found.");
  const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true, type: true, isActive: true } });
  if (!category || category.type !== "EXPENSE" || !category.isActive) throw new Error("Budget category not found or inactive.");
  const subcategoryId = input.subcategoryId || undefined;
  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({ where: { id: subcategoryId, categoryId: input.categoryId, isActive: true }, select: { id: true } });
    if (!subcategory) throw new Error("Subcategory does not belong to the selected category.");
  }
  const budget = await prisma.budget.upsert({ where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } }, create: { name: `Budget ${monthLabel(input.month)}`, currencyId: currency.id, periodStart: start, periodEnd: end }, update: {} });
  if (budget.totalAmount !== null) throw new Error("This month uses an overall budget. Remove the overall budget before adding category budgets.");
  const overlapping = await prisma.budgetItem.findMany({ where: { budgetId: budget.id, categoryId: input.categoryId } });
  if (!subcategoryId && overlapping.some((item) => item.subcategoryId)) throw new Error("A category budget cannot coexist with subcategory budgets for the same category.");
  if (subcategoryId && overlapping.some((item) => !item.subcategoryId)) throw new Error("Subcategory budgets cannot coexist with a category-level budget for the same category.");
  const existing = overlapping.find((item) => (item.subcategoryId ?? null) === (subcategoryId ?? null));
  if (existing) return prisma.budgetItem.update({ where: { id: existing.id }, data: { amount: input.amount } });
  return prisma.budgetItem.create({ data: { budgetId: budget.id, categoryId: input.categoryId, subcategoryId: subcategoryId ?? null, amount: input.amount } });
}

export async function deleteBudgetItem(id: string) { return prisma.budgetItem.delete({ where: { id } }); }

export async function clearOverallBudget(month: string, currencyCode: string) {
  const { start, end } = monthBounds(month); const currency = await prisma.currency.findUnique({ where: { code: currencyCode } }); if (!currency) throw new Error("Currency not found.");
  const budget = await prisma.budget.findUnique({ where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } } });
  if (!budget) return budget; return prisma.budget.update({ where: { id: budget.id }, data: { totalAmount: null } });
}

async function historicalMonths(month: string, count = 6) { return Array.from({ length: count }, (_, index) => shiftMonth(month, -(index + 1))); }
async function monthExpenseStats(month: string, currencyId: string) {
  const { start, end } = monthBounds(month);
  const [expenses, income] = await Promise.all([
    prisma.transaction.findMany({ where: { kind: "STANDARD", type: "EXPENSE", transactionDate: { gte: start, lt: end }, wallet: { currencyId } }, select: { amount: true, categoryId: true, subcategoryId: true } }),
    prisma.transaction.aggregate({ where: { kind: "STANDARD", type: "INCOME", transactionDate: { gte: start, lt: end }, wallet: { currencyId } }, _sum: { amount: true } }),
  ]);
  return { expenses, income: Number(income._sum.amount ?? 0) };
}
function roundBudget(value: number) { return Math.max(Math.round(value / 1000) * 1000, 0); }
async function recommendTotalBudget(month: string, currencyId: string, currentIncome: number, currentExpense: number) {
  const stats = await Promise.all((await historicalMonths(month)).map((item) => monthExpenseStats(item, currencyId)));
  const incomes = stats.map((item) => item.income).filter((value) => value > 0); const expenses = stats.map((item) => item.expenses.reduce((sum, tx) => sum + Number(tx.amount), 0)).filter((value) => value > 0);
  const avgIncome = currentIncome > 0 ? currentIncome : incomes.length ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0; const avgExpense = currentExpense > 0 ? currentExpense : expenses.length ? expenses.reduce((a, b) => a + b, 0) / expenses.length : 0;
  if (avgIncome <= 0) return roundBudget(avgExpense * 1.05); return roundBudget(Math.min(avgIncome * 0.8, Math.max(avgExpense * 1.03, 0)));
}

export async function getBudgetSuggestion(month: string, currencyCode: string): Promise<BudgetSuggestion> {
  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } }); if (!currency) throw new Error("Currency not found.");
  const historyMonths = await historicalMonths(month); const current = await monthExpenseStats(month, currency.id);
  const [history, previousBudget] = await Promise.all([
    Promise.all(historyMonths.map((item) => monthExpenseStats(item, currency.id))),
    (async () => { const previousMonth = shiftMonth(month, -1); const bounds = monthBounds(previousMonth); return prisma.budget.findUnique({ where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: bounds.start, periodEnd: bounds.end } }, include: { items: true } }); })(),
  ]);
  const incomeValues = [...history.map((item) => item.income), current.income].filter((value) => value > 0);
  const expenseValues = [...history.map((item) => item.expenses.reduce((sum, tx) => sum + Number(tx.amount), 0)), current.expenses.reduce((sum, tx) => sum + Number(tx.amount), 0)].filter((value) => value > 0);
  const incomeEstimate = incomeValues.length ? incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length : 0; const historicalExpenseAverage = expenseValues.length ? expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length : 0;
  const previousBudgetTotal = previousBudget?.totalAmount?.toNumber() ?? previousBudget?.items.reduce((sum, item) => sum + item.amount.toNumber(), 0) ?? 0;
  const recommendedTotalBudget = roundBudget(Math.min(incomeEstimate > 0 ? incomeEstimate * 0.8 : historicalExpenseAverage * 1.05, Math.max(historicalExpenseAverage * 1.03, previousBudgetTotal * 0.98)));
  const categoryMap = new Map<string, { amounts: number[]; previous: number }>();
  for (const stats of history) for (const tx of stats.expenses) if (tx.categoryId) { const entry = categoryMap.get(tx.categoryId) ?? { amounts: [], previous: 0 }; entry.amounts.push(Number(tx.amount)); categoryMap.set(tx.categoryId, entry); }
  const categoryIds = [...categoryMap.keys()];
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } });
  for (const entry of categoryMap.values()) entry.previous = 0;
  for (const item of previousBudget?.items ?? []) if (item.categoryId) { const entry = categoryMap.get(item.categoryId); if (entry) entry.previous += item.amount.toNumber(); }
  const raw = categories.map((category) => { const entry = categoryMap.get(category.id) ?? { amounts: [], previous: 0 }; const historicalAverage = entry.amounts.length ? entry.amounts.reduce((a, b) => a + b, 0) / entry.amounts.length : 0; return { categoryId: category.id, categoryName: category.name, historicalAverage, previousBudget: entry.previous, recommended: historicalAverage * 0.65 + entry.previous * 0.35 }; }).filter((item) => item.recommended > 0);
  const rawSum = raw.reduce((sum, item) => sum + item.recommended, 0); const scale = rawSum > 0 && recommendedTotalBudget > 0 ? Math.min(1, recommendedTotalBudget / rawSum) : 1;
  const items = raw.map((item) => ({ categoryId: item.categoryId, categoryName: item.categoryName, subcategoryId: null, subcategoryName: null, recommendedAmount: roundBudget(item.recommended * scale), historicalAverage: roundBudget(item.historicalAverage), previousBudget: roundBudget(item.previousBudget) }));
  const coverage = history.filter((item) => item.expenses.length > 0).length;
  return { month, currencyCode, incomeEstimate: roundBudget(incomeEstimate), historicalExpenseAverage: roundBudget(historicalExpenseAverage), previousBudgetTotal: roundBudget(previousBudgetTotal), recommendedTotalBudget, confidence: coverage >= 5 ? "HIGH" : coverage >= 3 ? "MEDIUM" : "LOW", items };
}

export async function applyBudgetSuggestion(input: BudgetSuggestion, mode: "OVERALL" | "CATEGORY") {
  if (mode === "OVERALL") return upsertOverallBudget({ month: input.month, currencyCode: input.currencyCode, amount: input.recommendedTotalBudget });
  await clearExistingCategoryBudgets(input.month, input.currencyCode);
  for (const item of input.items) if (item.categoryId) await upsertBudgetItem({ month: input.month, currencyCode: input.currencyCode, categoryId: item.categoryId, amount: item.recommendedAmount });
}

async function clearExistingCategoryBudgets(month: string, currencyCode: string) {
  const { start, end } = monthBounds(month); const currency = await prisma.currency.findUnique({ where: { code: currencyCode } }); if (!currency) throw new Error("Currency not found.");
  const budget = await prisma.budget.findUnique({ where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } } }); if (!budget) return;
  await prisma.$transaction([prisma.budget.update({ where: { id: budget.id }, data: { totalAmount: null } }), prisma.budgetItem.deleteMany({ where: { budgetId: budget.id } })]);
}
