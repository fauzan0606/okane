import { WalletType } from "@prisma/client";
import { z } from "zod";

const balanceSchema = z
  .string()
  .trim()
  .min(1, "Opening balance is required.")
  .refine((value) => /^-?\d+(\.\d+)?$/.test(value), {
    message: "Opening balance must be a valid number.",
  });

export const walletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Wallet name is required.")
    .max(100, "Wallet name must be less than 100 characters."),

  walletType: z.nativeEnum(WalletType),

  currencyCode: z
    .string()
    .trim()
    .length(3, "Currency code must be 3 characters."),

  currentBalance: balanceSchema,

  bank: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),

  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});

export type WalletSchema = z.infer<typeof walletSchema>;
