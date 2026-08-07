import { TransactionType } from "@prisma/client";

export const TRANSACTION_TYPES = [
  TransactionType.EXPENSE,
  TransactionType.INCOME,
] as const;

export function formatTransactionType(
  type: TransactionType
) {
  switch (type) {
    case TransactionType.EXPENSE:
      return "Expense";

    case TransactionType.INCOME:
      return "Income";
  }
}