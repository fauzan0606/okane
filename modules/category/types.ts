import { CategoryType } from "@prisma/client";

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;

  icon?: string;
  color?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: CategoryType;

  icon?: string;
  color?: string;
}

export type CategoryActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};