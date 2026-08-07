"use server";

import { revalidatePath } from "next/cache";

import {
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
} from "./service";

import { categorySchema } from "./schema";
import type { CategoryActionState } from "./types";

export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon"),
    color: formData.get("color"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createCategoryService(parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create category.",
    };
  }

  revalidatePath("/category");

  return {
    success: true,
  };
}

export async function updateCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing category id.",
    };
  }

  const parsed = categorySchema.partial().safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon"),
    color: formData.get("color"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateCategoryService(id, parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update category.",
    };
  }

  revalidatePath("/category");

  return {
    success: true,
  };
}

export async function deleteCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing category id.",
    };
  }

  try {
    await deleteCategoryService(id);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete category.",
    };
  }

  revalidatePath("/category");

  return {
    success: true,
  };
}