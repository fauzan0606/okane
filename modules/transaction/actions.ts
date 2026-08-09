"use server";

import { revalidatePath } from "next/cache";

import { createTransactionService, deleteTransactionService, updateTransactionService } from "./service";
import { transactionSchema } from "./schema";
import type { TransactionActionState } from "./types";

function revalidateFinancialViews() {
  revalidatePath("/transactions");
  revalidatePath("/transactions/smart");
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
  revalidatePath("/");
}

function formValues(formData: FormData) {
  return {
    transactionDate: formData.get("transactionDate"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    walletId: formData.get("walletId"),
    categoryId: formData.get("categoryId"),
    merchant: formData.get("merchant"),
    note: formData.get("note"),
    installmentEnabled: formData.get("installmentEnabled"),
    installmentTenor: formData.get("installmentTenor"),
    installmentStartDate: formData.get("installmentStartDate"),
    installmentFee: formData.get("installmentFee"),
  };
}

export async function createTransactionAction(_prevState: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const parsed = transactionSchema.safeParse(formValues(formData));
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await createTransactionService({
      ...parsed.data,
      installment: parsed.data.installmentEnabled ? {
        enabled: true,
        tenorMonths: parsed.data.installmentTenor,
        startDate: parsed.data.installmentStartDate,
        feeAmount: parsed.data.installmentFee,
      } : { enabled: false },
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to create transaction." };
  }
  revalidateFinancialViews();
  return { success: true };
}

export async function updateTransactionAction(_prevState: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return { success: false, message: "Missing transaction id." };
  const parsed = transactionSchema.partial().safeParse(formValues(formData));
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await updateTransactionService(id, {
      ...parsed.data,
      installment: parsed.data.installmentEnabled === undefined ? undefined : {
        enabled: parsed.data.installmentEnabled,
        tenorMonths: parsed.data.installmentTenor,
        startDate: parsed.data.installmentStartDate,
        feeAmount: parsed.data.installmentFee,
      },
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to update transaction." };
  }
  revalidateFinancialViews();
  return { success: true };
}

export async function deleteTransactionAction(_prevState: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return { success: false, message: "Missing transaction id." };
  try {
    await deleteTransactionService(id);
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to delete transaction." };
  }
  revalidateFinancialViews();
  return { success: true };
}