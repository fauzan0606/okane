import { TransactionType } from "@prisma/client";

export interface InstallmentInput {
  enabled: boolean;
  tenorMonths?: number;
  startDate?: Date;
  feeAmount?: number;
}

export interface CreateTransactionInput {
  transactionDate: Date;
  type: TransactionType;
  amount: number;
  walletId: string;
  categoryId?: string;
  merchant?: string;
  note?: string;
  installment?: InstallmentInput;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

export type TransactionActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};