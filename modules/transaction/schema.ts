import { z } from "zod";
import { TransactionType } from "@prisma/client";

export const transactionSchema = z.object({
  transactionDate: z.coerce.date(),

  type: z.nativeEnum(TransactionType),

  amount: z.coerce.number().positive(),

  walletId: z.string().min(1),

  categoryId: z
    .string()
    .optional()
    .transform((v) => v || undefined),

  payeeId: z
    .string()
    .optional()
    .transform((v) => v || undefined),

  note: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
});

export type TransactionSchema = z.infer<
  typeof transactionSchema
>;