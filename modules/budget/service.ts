import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BudgetOverview } from "./types";

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Month must use YYYY-MM format.");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Invalid month.");
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const { start } = monthBounds(month);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(start);
}

export async function getBudgetOverview(month = currentMonthKey(), currencyCode = "IDR"): Promise<BudgetOverview> {
  const { start, end } = monthBounds(month);
  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
  if (!currency) throw new Error(`Currency ${currencyCode} not found.`);

  const budget = await prisma.budget.upsert({
    where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } },
    create: { name: `Budget ${monthLabel(month)}`, currencyId: currency.id, periodStart: start, periodEnd: end },
    update: {},
    include: { items: { include: { category: true, subcategory: true }, orderBy: [{ category: { name: "asc" } }, { createdAt: "asc" }] } },
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      kind: "STANDARD",
      type: "EXPENSE",
      transactionDate: { gte: start, lt: end },
      wallet: { currencyId: currency.id },
    },
    select: { amount: true, categoryId: true, subcategoryId: true },
  });

  const totalActual = transactions.reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));
  const items = budget.items.map((item) => {
    const actual = transactions
      .filter((transaction) => item.subcategoryId ? transaction.subcategoryId === item.subcategoryId : transaction.categoryId === item.categoryId)
      .reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));
    const budgetAmount = item.amount;
    const remaining = budgetAmount.minus(actual);
    const percentage = budgetAmount.gt(0) ? actual.div(budgetAmount).mul(100).toNumber() : 0;
    return {
      id: item.id,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      subcategoryId: item.subcategoryId,
      subcategoryName: item.subcategory?.name ?? null,
      budgetAmount: budgetAmount.toNumber(),
      actualAmount: actual.toNumber(),
      remainingAmount: remaining.toNumber(),
      percentage,
    };
  });

  const totalBudget = items.reduce((sum, item) => sum + item.budgetAmount, 0);
  const budgetedActual = items.reduce((sum, item) => sum + item.actualAmount, 0);
  const totalRemaining = totalBudget - budgetedActual;
  const unbudgetedActual = Math.max(totalActual.toNumber() - budgetedActual, 0);

  return {
    budgetId: budget.id,
    name: budget.name,
    month,
    currency: { id: currency.id, code: currency.code, name: currency.name, symbol: currency.symbol, decimalPlaces: currency.decimalPlaces },
    totalBudget,
    totalActual: totalActual.toNumber(),
    totalRemaining,
    unbudgetedActual,
    items,
  };
}

export async function getBudgetFormData(currencyCode = "IDR") {
  const [currencies, categories, subcategories] = await Promise.all([
    prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, symbol: true, decimalPlaces: true } }),
    prisma.category.findMany({ where: { isActive: true, type: "EXPENSE" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.subcategory.findMany({ where: { isActive: true, category: { type: "EXPENSE" } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, categoryId: true, name: true } }),
  ]);
  return { currencies, categories, subcategories, selectedCurrency: currencies.find((currency) => currency.code === currencyCode)?.code ?? currencies[0]?.code ?? currencyCode };
}

export async function upsertBudgetItem(input: { month: string; currencyCode: string; categoryId: string; subcategoryId?: string; amount: number }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Budget amount must be greater than zero.");
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

  const budget = await prisma.budget.upsert({
    where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } },
    create: { name: `Budget ${monthLabel(input.month)}`, currencyId: currency.id, periodStart: start, periodEnd: end },
    update: {},
  });

  const overlapping = await prisma.budgetItem.findMany({ where: { budgetId: budget.id, categoryId: input.categoryId } });
  if (!subcategoryId && overlapping.some((item) => item.subcategoryId)) throw new Error("A category budget cannot coexist with subcategory budgets for the same category.");
  if (subcategoryId && overlapping.some((item) => !item.subcategoryId)) throw new Error("Subcategory budgets cannot coexist with a category-level budget for the same category.");

  const existing = overlapping.find((item) => (item.subcategoryId ?? null) === (subcategoryId ?? null));
  if (existing) {
    return prisma.budgetItem.update({ where: { id: existing.id }, data: { amount: input.amount } });
  }
  return prisma.budgetItem.create({ data: { budgetId: budget.id, categoryId: input.categoryId, subcategoryId: subcategoryId ?? null, amount: input.amount } });
}

export async function deleteBudgetItem(id: string) {
  return prisma.budgetItem.delete({ where: { id } });
}
