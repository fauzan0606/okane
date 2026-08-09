import { TransactionType } from "@prisma/client";
import { z } from "zod";

export const transactionSchema = z.object({
  transactionDate: z.coerce.date(),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  walletId: z.string().min(1, "Wallet is required."),
  categoryId: z.string().optional().transform((value) => value || undefined),
  merchant: z.string().trim().optional().transform((value) => value || undefined),
  note: z.string().trim().optional().transform((value) => value || undefined),
  installmentEnabled: z.coerce.boolean().default(false),
  installmentTenor: z.coerce.number().int().min(2).max(120).optional(),
  installmentStartDate: z.coerce.date().optional(),
  installmentFee: z.coerce.number().min(0).optional(),
}).superRefine((value, ctx) => {
  if (value.installmentEnabled && !value.installmentTenor) {
    ctx.addIssue({ code: "custom", path: ["installmentTenor"], message: "Installment tenor is required." });
  }
});

export type TransactionSchema = z.infer<typeof transactionSchema>;