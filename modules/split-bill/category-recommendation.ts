import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type CategoryOption = { id: string; name: string };
type SubcategoryOption = { id: string; name: string; categoryId: string };

type CategoryRecommendation = {
  categoryId: string | null;
  subcategoryId: string | null;
  confidence: "HIGH" | "MEDIUM" | "NONE";
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getSplitBillCategoryOptions() {
  const [categories, subcategories] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, type: "EXPENSE" }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.subcategory.findMany({ where: { isActive: true }, select: { id: true, name: true, categoryId: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return { categories: categories as CategoryOption[], subcategories: subcategories as SubcategoryOption[] };
}

export async function recommendSplitBillCategories(merchantNames: string[]) {
  const normalizedNames = new Set(merchantNames.map(normalizeText).filter(Boolean));
  const recommendations = new Map<string, CategoryRecommendation>();
  for (const merchantName of merchantNames) {
    recommendations.set(merchantName, { categoryId: null, subcategoryId: null, confidence: "NONE" });
  }
  if (normalizedNames.size === 0) return recommendations;

  const payees = await prisma.payee.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const payeeByName = new Map(payees.map((payee) => [normalizeText(payee.name), payee]));
  const matchedPayees = [...normalizedNames]
    .map((name) => [name, payeeByName.get(name)] as const)
    .filter((entry): entry is readonly [string, (typeof payees)[number]] => Boolean(entry[1]));
  if (matchedPayees.length === 0) return recommendations;

  const payeeIds = matchedPayees.map(([, payee]) => payee.id);
  const history = await prisma.$queryRaw<Array<{ payeeId: string; categoryId: string | null; subcategoryId: string | null; row_number: bigint }>>`
    SELECT "payeeId", "categoryId", "subcategoryId", row_number
    FROM (
      SELECT "payeeId", "categoryId", "subcategoryId",
        ROW_NUMBER() OVER (PARTITION BY "payeeId" ORDER BY "transactionDate" DESC, "createdAt" DESC, "id" DESC) AS row_number
      FROM "Transaction"
      WHERE "payeeId" IN (${Prisma.join(payeeIds)})
        AND "type" = 'EXPENSE'
        AND "kind" = 'STANDARD'
    ) recent
    WHERE row_number <= 50
    ORDER BY "payeeId", row_number
  `;
  const historiesByPayee = new Map<string, typeof history>();
  for (const transaction of history) {
    const transactions = historiesByPayee.get(transaction.payeeId) ?? [];
    transactions.push(transaction);
    historiesByPayee.set(transaction.payeeId, transactions);
  }

  for (const [normalizedName, payee] of matchedPayees) {
    const payeeHistory = historiesByPayee.get(payee.id) ?? [];
    const categoryRecommendation = getRecommendation(payeeHistory);
    for (const merchantName of merchantNames) {
      if (normalizeText(merchantName) === normalizedName) recommendations.set(merchantName, categoryRecommendation);
    }
  }
  return recommendations;
}

function getRecommendation(history: Array<{ categoryId: string | null; subcategoryId: string | null }>): CategoryRecommendation {
  if (history.length === 0) return { categoryId: null, subcategoryId: null, confidence: "NONE" };
  const categoryCounts = new Map<string, number>();
  const subcategoryCounts = new Map<string, number>();
  for (const transaction of history) {
    if (transaction.categoryId) categoryCounts.set(transaction.categoryId, (categoryCounts.get(transaction.categoryId) ?? 0) + 1);
    if (transaction.subcategoryId) subcategoryCounts.set(transaction.subcategoryId, (subcategoryCounts.get(transaction.subcategoryId) ?? 0) + 1);
  }

  const categoryId = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const subcategoryId = [...subcategoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!categoryId) return { categoryId: null, subcategoryId: null, confidence: "NONE" };

  const validSubcategory = subcategoryId && history.some((transaction) => transaction.subcategoryId === subcategoryId && transaction.categoryId === categoryId)
    ? subcategoryId
    : null;

  return {
    categoryId,
    subcategoryId: validSubcategory,
    confidence: validSubcategory ? "HIGH" : "MEDIUM",
  };
}
