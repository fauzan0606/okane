import { TransactionType } from "@prisma/client";

export interface CreateTransactionInput {
  transactionDate: Date;
  type: TransactionType;
  amount: number;

  walletId: string;

  categoryId?: string;

  /**
   * Merchant typed by the user.
   * It will be converted into a Payee internally.
   */
  merchant?: string;

  note?: string;
}

export type UpdateTransactionInput =
  Partial<CreateTransactionInput>;

export type TransactionActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};