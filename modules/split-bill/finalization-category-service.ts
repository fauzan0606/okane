import { prisma } from "@/lib/prisma";

export async function setFinalizedTransactionCategory(transactionId: string, categoryId: string, subcategoryId?: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, type: "EXPENSE", isActive: true }, select: { id: true } });
  if (!category) throw new Error("Please select a valid expense category.");

  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({ where: { id: subcategoryId, categoryId, isActive: true }, select: { id: true } });
    if (!subcategory) throw new Error("Please select a valid subcategory for the selected category.");
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: {
      category: { connect: { id: categoryId } },
      subcategory: subcategoryId ? { connect: { id: subcategoryId } } : { disconnect: true },
    },
  });
}
