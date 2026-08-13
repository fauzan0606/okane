import { prisma } from "@/lib/prisma";

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

export async function recommendSplitBillCategory(merchantName: string): Promise<CategoryRecommendation> {
  const normalizedMerchant = normalizeText(merchantName);
  if (!normalizedMerchant) return { categoryId: null, subcategoryId: null, confidence: "NONE" };

  const payees = await prisma.payee.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const payee = payees.find((candidate) => normalizeText(candidate.name) === normalizedMerchant);
  if (!payee) return { categoryId: null, subcategoryId: null, confidence: "NONE" };

  const history = await prisma.transaction.findMany({
    where: { payeeId: payee.id, type: "EXPENSE", kind: "STANDARD" },
    select: { categoryId: true, subcategoryId: true },
    orderBy: { transactionDate: "desc" },
    take: 50,
  });

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
