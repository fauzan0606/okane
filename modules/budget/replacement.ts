import { prisma } from "@/lib/prisma";

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Month must use YYYY-MM format.");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Invalid month.");
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}

async function getBudget(month: string, currencyCode: string) {
  const { start, end } = monthBounds(month);
  const currency = await prisma.currency.findUnique({ where: { code: currencyCode }, select: { id: true } });
  if (!currency) throw new Error("Currency not found.");
  const budget = await prisma.budget.findUnique({
    where: { currencyId_periodStart_periodEnd: { currencyId: currency.id, periodStart: start, periodEnd: end } },
    include: { items: { select: { id: true } } },
  });
  return { currencyId: currency.id, budget };
}

export type BudgetMode = "NONE" | "OVERALL" | "CATEGORY";

export async function getBudgetMode(month: string, currencyCode: string): Promise<BudgetMode> {
  const { budget } = await getBudget(month, currencyCode);
  if (!budget) return "NONE";
  if (budget.totalAmount !== null) return "OVERALL";
  if (budget.items.length > 0) return "CATEGORY";
  return "NONE";
}

export async function hasExistingBudget(month: string, currencyCode: string) {
  return (await getBudgetMode(month, currencyCode)) !== "NONE";
}

export async function replaceBudget(month: string, currencyCode: string, mode: "OVERALL" | "CATEGORY") {
  const { budget } = await getBudget(month, currencyCode);
  if (!budget) return null;
  await prisma.$transaction([
    prisma.budgetItem.deleteMany({ where: { budgetId: budget.id } }),
    prisma.budget.update({ where: { id: budget.id }, data: { totalAmount: mode === "OVERALL" ? 0 : null } }),
  ]);
  return budget.id;
}

export async function clearCategoryBudgets(month: string, currencyCode: string) {
  const { budget } = await getBudget(month, currencyCode);
  if (!budget) return null;
  await prisma.$transaction([
    prisma.budgetItem.deleteMany({ where: { budgetId: budget.id } }),
    prisma.budget.update({ where: { id: budget.id }, data: { totalAmount: null } }),
  ]);
  return budget.id;
}
