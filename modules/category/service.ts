import { CategoryType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "./repository";

import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./types";

const DEFAULT_CATEGORIES = [
  {
    name: "Food & Drinks",
    type: CategoryType.EXPENSE,
    icon: "🍽️",
    color: "#F97316",
  },
  {
    name: "Transport",
    type: CategoryType.EXPENSE,
    icon: "🚗",
    color: "#3B82F6",
  },
  {
    name: "Shopping",
    type: CategoryType.EXPENSE,
    icon: "🛍️",
    color: "#A855F7",
  },
  {
    name: "Bills & Utilities",
    type: CategoryType.EXPENSE,
    icon: "💡",
    color: "#EAB308",
  },
  {
    name: "Salary",
    type: CategoryType.INCOME,
    icon: "💰",
    color: "#22C55E",
  },
  {
    name: "Other Income",
    type: CategoryType.INCOME,
    icon: "✨",
    color: "#14B8A6",
  },
];

export async function listCategories() {
  const categories = await getCategories();

  if (categories.length > 0) {
    return categories;
  }

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      sortOrder: 0,
      isActive: true,
    })),
  });

  return getCategories();
}

export async function findCategory(id: string) {
  return getCategoryById(id);
}

export async function createCategoryService(
  input: CreateCategoryInput
) {
  return createCategory({
    name: input.name,
    type: input.type as CategoryType,

    icon: input.icon || null,
    color: input.color || null,

    sortOrder: 0,
    isActive: true,
  });
}

export async function updateCategoryService(
  id: string,
  input: UpdateCategoryInput
) {
  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.type !== undefined) {
    data.type = input.type;
  }

  if (input.icon !== undefined) {
    data.icon = input.icon;
  }

  if (input.color !== undefined) {
    data.color = input.color;
  }

  return updateCategory(id, data);
}

export async function deleteCategoryService(id: string) {
  return deleteCategory(id);
}
