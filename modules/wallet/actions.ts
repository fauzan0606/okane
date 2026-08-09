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

function fields(formData: FormData) {
  return {
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currencyCode: formData.get("currencyCode"),
    currentBalance: formData.get("currentBalance"),
    creditLimit: formData.get("creditLimit"),
    billingDate: formData.get("billingDate"),
    dueDate: formData.get("dueDate"),
    rewardPoint: formData.get("rewardPoint"),
    bank: formData.get("bank"),
    note: formData.get("note"),
  };
}

export async function createWalletAction(_prevState: WalletActionState, formData: FormData): Promise<WalletActionState> {
  const parsed = walletCreditCardSchema.safeParse(fields(formData));
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try { await createWalletService(parsed.data); }
  catch (error) { return { success: false, message: error instanceof Error ? error.message : "Failed to create wallet." }; }
  revalidateFinancialViews();
  return { success: true };
}

export async function updateWalletAction(_prevState: WalletActionState, formData: FormData): Promise<WalletActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { success: false, message: "Missing wallet id." };
  const parsed = updateWalletSchema.safeParse(fields(formData));
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
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
