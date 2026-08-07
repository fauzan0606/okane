import { CategoryType } from "@prisma/client";

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

export async function listCategories() {
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