import { CategoryType } from "@prisma/client";
import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(100, "Category name must be less than 100 characters."),

  type: z.nativeEnum(CategoryType),

  icon: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),

  color: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

export type CategorySchema = z.infer<typeof categorySchema>;