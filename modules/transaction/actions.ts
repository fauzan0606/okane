"use server";

import { revalidatePath } from "next/cache";

import { applyTransactionMappingToMerchantService, createTransactionService, deleteTransactionService, updateTransactionService } from "./service";
import { transactionSchema } from "./schema";
import type { TransactionActionState } from "./types";

function revalidateFinancialViews() {
  revalidatePath("/transactions");
  revalidatePath("/transactions/smart");
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
  revalidatePath("/");
}

function nullableToUndefined(value: FormDataEntryValue | null) {
  if (value === null || value instanceof File) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function formValues(formData: FormData) {
  return {
    transactionDate: formData.get("transactionDate"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    walletId: formData.get("walletId"),
    categoryId: nullableToUndefined(formData.get("categoryId")),
    subcategoryId: nullableToUndefined(formData.get("subcategoryId")),
    merchant: nullableToUndefined(formData.get("merchant")),
    note: nullableToUndefined(formData.get("note")),
    installmentEnabled: formData.get("installmentEnabled"),
    installmentTenor: nullableToUndefined(formData.get("installmentTenor")),
    installmentStartDate: nullableToUndefined(formData.get("installmentStartDate")),
    installmentFee: nullableToUndefined(formData.get("installmentFee")),
  };
}

function validationState(parsed: { error: { flatten: () => { fieldErrors: Record<string, string[]> } } }): TransactionActionState {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  const firstError = Object.values(fieldErrors).flat()[0];
  return {
    success: false,
    fieldErrors,
    message: firstError ?? "Please check the transaction details and try again.",
  };
}

export async function createTransactionAction(_prevState: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const parsed = transactionSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationState(parsed);
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

  const parsed = transactionSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationState(parsed);

  try {
    await updateTransactionService(id, {
      ...parsed.data,
      installment: {
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

export async function applyTransactionMappingToMerchantAction(_prevState: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const id = formData.get("id");
  const walletId = formData.get("walletId");
  const categoryId = nullableToUndefined(formData.get("categoryId"));
  const subcategoryId = nullableToUndefined(formData.get("subcategoryId"));
  if (typeof id !== "string" || !id) return { success: false, message: "Missing transaction id." };
  if (typeof walletId !== "string" || !walletId) return { success: false, message: "Wallet is required before applying the mapping." };
  if (!categoryId || !subcategoryId) return { success: false, message: "Category and subcategory are required before applying the mapping." };

  try {
    const count = await applyTransactionMappingToMerchantService(id, { walletId, categoryId, subcategoryId });
    revalidateFinancialViews();
    return { success: true, message: `Updated ${count} transactions with the same merchant.` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to update matching transactions." };
  }
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
