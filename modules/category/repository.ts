import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CategoryWithRelations =
  Prisma.CategoryGetPayload<object>;

export async function getCategories(): Promise<CategoryWithRelations[]> {
  return prisma.category.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      {
        type: "asc",
      },
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function getCategoryById(
  id: string
): Promise<CategoryWithRelations | null> {
  return prisma.category.findUnique({
    where: {
      id,
    },
  });
}

export async function createCategory(
  data: Prisma.CategoryCreateInput
) {
  return prisma.category.create({
    data,
  });
}

export async function updateCategory(
  id: string,
  data: Prisma.CategoryUpdateInput
) {
  return prisma.category.update({
    where: {
      id,
    },
    data,
  });
}

export async function deleteCategory(id: string) {
  return prisma.category.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });
}