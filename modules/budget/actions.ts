"use server";

import { revalidatePath } from "next/cache";
import { deleteBudgetItem, applyBudgetSuggestion, clearOverallBudget, upsertBudgetItem, upsertOverallBudget } from "./service";
import { getBudgetSuggestionV2 } from "./suggestion-service";
import { clearCategoryBudgets, getBudgetMode, hasExistingBudget, replaceBudget } from "./replacement";

function text(value: FormDataEntryValue | null) { return typeof value === "string" ? value : ""; }

const replacementMessage = "A budget already exists for this month. Replace the existing budget with this new one?";

export async function upsertBudgetItemAction(formData: FormData) {
  try {
    const month = text(formData.get("month"));
    const currencyCode = text(formData.get("currencyCode"));
    const editing = text(formData.get("editing")) === "true";
    const replaceExisting = text(formData.get("replaceExisting")) === "true";
    if (!editing && !replaceExisting && await hasExistingBudget(month, currencyCode)) return { success: false, requiresReplacement: true, message: replacementMessage };
    if (replaceExisting) await replaceBudget(month, currencyCode, "CATEGORY");
    await upsertBudgetItem({ month, currencyCode, categoryId: text(formData.get("categoryId")), subcategoryId: text(formData.get("subcategoryId")) || undefined, amount: Number(text(formData.get("amount"))) });
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to save budget." };
  }
}

export async function upsertOverallBudgetAction(formData: FormData) {
  try {
    const month = text(formData.get("month"));
    const currencyCode = text(formData.get("currencyCode"));
    const editing = text(formData.get("editing")) === "true";
    const replaceExisting = text(formData.get("replaceExisting")) === "true";
    if (!editing && !replaceExisting && await hasExistingBudget(month, currencyCode)) return { success: false, requiresReplacement: true, message: replacementMessage };
    if (replaceExisting) await replaceBudget(month, currencyCode, "OVERALL");
    await upsertOverallBudget({ month, currencyCode, amount: Number(text(formData.get("amount"))) });
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

export async function clearCategoryBudgetsAction(formData: FormData) {
  try {
    await clearCategoryBudgets(text(formData.get("month")), text(formData.get("currencyCode")));
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to delete category budgets." };
  }
}

export async function getBudgetStatusAction(formData: FormData) {
  try {
    return { success: true, mode: await getBudgetMode(text(formData.get("month")), text(formData.get("currencyCode"))) };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to read budget status." };
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
    const replaceExisting = text(formData.get("replaceExisting")) === "true";
    if (!replaceExisting && await hasExistingBudget(suggestion.month, suggestion.currencyCode)) return { success: false, requiresReplacement: true, message: replacementMessage };
    if (replaceExisting) await replaceBudget(suggestion.month, suggestion.currencyCode, mode);
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
