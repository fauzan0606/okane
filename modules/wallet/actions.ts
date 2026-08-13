"use server";

import { revalidatePath } from "next/cache";
import { createWalletService, updateWalletService, deleteWalletService } from "./service";
import { updateWalletSchema, walletCreditCardSchema } from "./schemaCreditCard";
import type { WalletActionState } from "./types";

function revalidateFinancialViews() {
  revalidatePath("/wallet");
  revalidatePath("/");
  revalidatePath("/credit-card");
}

function optionalField(formData: FormData, name: string) {
  const value = formData.get(name);
  return value === null ? undefined : value;
}

function fields(formData: FormData) {
  return {
    name: optionalField(formData, "name"),
    walletType: optionalField(formData, "walletType"),
    currencyCode: optionalField(formData, "currencyCode"),
    currentBalance: optionalField(formData, "currentBalance"),
    creditLimit: optionalField(formData, "creditLimit"),
    billingDate: optionalField(formData, "billingDate"),
    dueDate: optionalField(formData, "dueDate"),
    rewardPoint: optionalField(formData, "rewardPoint"),
    bank: optionalField(formData, "bank"),
    note: optionalField(formData, "note"),
  };
}

function validationState(parsed: { error: { flatten: () => { fieldErrors: Record<string, string[]> } } }): WalletActionState {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  const firstError = Object.values(fieldErrors).flat()[0];
  return {
    success: false,
    fieldErrors,
    message: firstError ?? "Please check the wallet details and try again.",
  };
}

export async function createWalletAction(_prevState: WalletActionState, formData: FormData): Promise<WalletActionState> {
  const parsed = walletCreditCardSchema.safeParse(fields(formData));
  if (!parsed.success) return validationState(parsed);
  try { await createWalletService(parsed.data); }
  catch (error) { return { success: false, message: error instanceof Error ? error.message : "Failed to create wallet." }; }
  revalidateFinancialViews();
  return { success: true };
}

export async function updateWalletAction(_prevState: WalletActionState, formData: FormData): Promise<WalletActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { success: false, message: "Missing wallet id." };
  const parsed = updateWalletSchema.safeParse(fields(formData));
  if (!parsed.success) return validationState(parsed);
  try { await updateWalletService(id, parsed.data); }
  catch (error) { return { success: false, message: error instanceof Error ? error.message : "Failed to update wallet." }; }
  revalidateFinancialViews();
  return { success: true };
}

export async function deleteWalletAction(_prevState: WalletActionState, formData: FormData): Promise<WalletActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { success: false, message: "Missing wallet id." };
  try { await deleteWalletService(id); }
  catch (error) { return { success: false, message: error instanceof Error ? error.message : "Failed to delete wallet." }; }
  revalidateFinancialViews();
  return { success: true };
}
