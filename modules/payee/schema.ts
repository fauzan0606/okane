import { z } from "zod";

export const payeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Payee name is required.")
    .max(100, "Payee name must be less than 100 characters."),

  note: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

export type PayeeSchema = z.infer<typeof payeeSchema>;