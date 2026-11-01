import { createTransactionService } from "@/modules/transaction/service";
import type { ParsedTransaction } from "../types";

export async function saveParsedTransaction(parsed: ParsedTransaction) {
  if (!parsed.wallet) throw new Error("Wallet could not be detected.");
  if (!parsed.amount) throw new Error("Amount could not be detected.");

  const transactionDate = new Date(`${parsed.transactionDate}T00:00:00`);
  if (Number.isNaN(transactionDate.getTime())) throw new Error("Transaction date is invalid.");

  return createTransactionService({
    transactionDate,
    type: parsed.type,
    reimbursementEnabled: parsed.reimbursementEnabled ?? false,
    tipsEnabled: parsed.tipsEnabled ?? false,
    tipsAmount: parsed.tipsAmount,
    amount: parsed.amount,
    walletId: parsed.wallet.id,
    categoryId: parsed.category?.id,
    subcategoryId: parsed.subcategory?.id,
    merchant: parsed.merchant,
    installment: parsed.installment?.enabled
      ? {
          enabled: true,
          tenorMonths: parsed.installment.tenorMonths,
          startDate: parsed.installment.startDate
            ? new Date(`${parsed.installment.startDate}T00:00:00`)
            : undefined,
          feeAmount: parsed.installment.feeAmount,
        }
      : { enabled: false },
  });
}
