import { CategoryType } from "@prisma/client";

export const CATEGORY_TYPES = [
  CategoryType.INCOME,
  CategoryType.EXPENSE,
] as const;

export function formatCategoryType(type: CategoryType): string {
  switch (type) {
    case CategoryType.INCOME:
      return "Income";

    case CategoryType.EXPENSE:
      return "Expense";

    default:
      return type;
  }
}