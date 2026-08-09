import { WalletType } from "@prisma/client";
import { z } from "zod";

const balanceSchema = z.string().trim().min(1).refine((value) => /^-?\d+(\.\d+)?$/.test(value), {
  message: "Opening balance must be a valid number.",
});

const amountSchema = z.string().trim().min(1).refine((value) => /^\d+(\.\d+)?$/.test(value), {
  message: "Amount must be a valid non-negative number.",
});

const daySchema = z.coerce.number().int().min(1).max(31);

export const walletCreditCardBaseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  walletType: z.nativeEnum(WalletType),
  currencyCode: z.string().trim().length(3),
  currentBalance: balanceSchema,
  creditLimit: amountSchema.optional(),
  billingDate: daySchema.optional(),
  dueDate: daySchema.optional(),
  rewardPoint: amountSchema.optional(),
  bank: z.string().trim().max(100).optional().transform((value) => value || undefined),
  note: z.string().trim().max(500).optional().transform((value) => value || undefined),
});

export const walletCreditCardSchema = walletCreditCardBaseSchema.superRefine((value, ctx) => {
  if (value.walletType !== WalletType.CREDIT_CARD) return;

  if (!value.creditLimit) {
    ctx.addIssue({
      code: "custom",
      path: ["creditLimit"],
      message: "Credit limit is required for a credit card.",
    });
  }

  if (value.billingDate === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["billingDate"],
      message: "Billing day is required for a credit card.",
    });
  }

  if (value.dueDate === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Due day is required for a credit card.",
    });
  }
});

export const updateWalletSchema = walletCreditCardBaseSchema.partial();
