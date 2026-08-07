import { TransactionType } from "@prisma/client";

export interface CreateTransactionInput {
  transactionDate: Date;
  type: TransactionType;
  amount: number;
  walletId: string;
  categoryId?: string;
  payeeId?: string;
  note?: string;
}

export type UpdateTransactionInput =
  Partial<CreateTransactionInput>;

export type TransactionActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};