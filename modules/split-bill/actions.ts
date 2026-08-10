"use server";

import { revalidatePath } from "next/cache";
import { createSplitBill, deleteSplitBill } from "./service";

function parsePayload(formData: FormData) {
  const value = formData.get("payload");
  if (typeof value !== "string" || !value.trim()) throw new Error("Split Bill data is missing.");
  try {
    return JSON.parse(value) as { transactionId: string; participants: { name: string; isMe: boolean }[]; items: { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] }[]; note?: string };
  } catch {
    throw new Error("Invalid Split Bill data.");
  }
}

function refreshAll() {
  revalidatePath("/split-bill");
  revalidatePath("/receivables");
  revalidatePath("/transactions");
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
  revalidatePath("/");
}

export async function createSplitBillAction(formData: FormData) {
  await createSplitBill(parsePayload(formData));
  refreshAll();
}

export async function deleteSplitBillAction(formData: FormData) {
  const id = formData.get("splitBillId");
  if (typeof id !== "string" || !id) throw new Error("Split Bill not found.");
  await deleteSplitBill(id);
  refreshAll();
}
