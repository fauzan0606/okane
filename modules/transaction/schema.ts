import { TransactionType } from "@prisma/client";
import { z } from "zod";

const checkbox = z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean());

export const transactionSchema = z.object({
  transactionDate: z.coerce.date(),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  walletId: z.string().min(1, "Wallet is required."),
  categoryId: z.string().optional().transform((value) => value || undefined),
  subcategoryId: z.string().optional().transform((value) => value || undefined),
  merchant: z.string().trim().optional().transform((value) => value || undefined),
  note: z.string().trim().optional().transform((value) => value || undefined),
  installmentEnabled: checkbox.default(false),
  installmentTenor: z.coerce.number().int().min(2).max(120).optional(),
  installmentStartDate: z.coerce.date().optional(),
  installmentFee: z.coerce.number().min(0).optional(),
}).superRefine((value, ctx) => {
  if (value.installmentEnabled && !value.installmentTenor) {
    ctx.addIssue({ code: "custom", path: ["installmentTenor"], message: "Installment tenor is required." });
  }
  if (value.subcategoryId && !value.categoryId) {
    ctx.addIssue({ code: "custom", path: ["subcategoryId"], message: "Category is required when a subcategory is selected." });
  }
});

export type TransactionSchema = z.infer<typeof transactionSchema>;