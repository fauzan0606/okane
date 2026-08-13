"use server";

import { revalidatePath } from "next/cache";
import { deleteBudgetItem, upsertBudgetItem } from "./service";

function text(value: FormDataEntryValue | null) { return typeof value === "string" ? value : ""; }

export async function upsertBudgetItemAction(formData: FormData) {
  try {
    await upsertBudgetItem({
      month: text(formData.get("month")),
      currencyCode: text(formData.get("currencyCode")),
      categoryId: text(formData.get("categoryId")),
      subcategoryId: text(formData.get("subcategoryId")) || undefined,
      amount: Number(text(formData.get("amount"))),
    });
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to save budget." };
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
