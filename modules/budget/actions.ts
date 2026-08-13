"use server";

import { revalidatePath } from "next/cache";
import { deleteBudgetItem, applyBudgetSuggestion, clearOverallBudget, upsertBudgetItem, upsertOverallBudget } from "./service";
import { getBudgetSuggestionV2 } from "./suggestion-service";

function text(value: FormDataEntryValue | null) { return typeof value === "string" ? value : ""; }

export async function upsertBudgetItemAction(formData: FormData) {
  try {
    await upsertBudgetItem({ month: text(formData.get("month")), currencyCode: text(formData.get("currencyCode")), categoryId: text(formData.get("categoryId")), subcategoryId: text(formData.get("subcategoryId")) || undefined, amount: Number(text(formData.get("amount"))) });
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to save budget." };
  }
}

export async function upsertOverallBudgetAction(formData: FormData) {
  try {
    await upsertOverallBudget({ month: text(formData.get("month")), currencyCode: text(formData.get("currencyCode")), amount: Number(text(formData.get("amount"))) });
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to save overall budget." };
  }
}

export async function clearOverallBudgetAction(formData: FormData) {
  try {
    await clearOverallBudget(text(formData.get("month")), text(formData.get("currencyCode")));
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to clear overall budget." };
  }
}

export async function getBudgetSuggestionAction(formData: FormData) {
  try {
    const suggestion = await getBudgetSuggestionV2(text(formData.get("month")), text(formData.get("currencyCode")));
    return { success: true, suggestion };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to calculate budget suggestion." };
  }
}

export async function applyBudgetSuggestionAction(formData: FormData) {
  try {
    const suggestion = JSON.parse(text(formData.get("suggestion")));
    const mode = text(formData.get("mode")) === "CATEGORY" ? "CATEGORY" : "OVERALL";
    await applyBudgetSuggestion(suggestion, mode);
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to apply budget suggestion." };
  }
}

export async function deleteBudgetItemAction(formData: FormData) {
  try {
    const id = text(formData.get("id"));
    if (!id) throw new Error("Budget item id is required.");
    await deleteBudgetItem(id);
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to delete budget." };
  }
}
