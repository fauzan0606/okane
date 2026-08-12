"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSplitBill, deleteSplitBill, finalizeSplitBill } from "./service";
import { updateSplitBillItemAllocation } from "./item-edit-service";

function refreshAll() {
  revalidatePath("/split-bill");
  revalidatePath("/receivables");
  revalidatePath("/transactions");
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
  revalidatePath("/");
}

function parseCreatePayload(formData: FormData) {
  const value = formData.get("payload");
  if (typeof value !== "string" || !value.trim()) throw new Error("Split Bill data is missing.");
  try {
    return JSON.parse(value) as {
      merchantName: string;
      participants: { name: string; isMe: boolean }[];
      items: { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] }[];
      tax?: { mode: "AMOUNT" | "PERCENT"; value: number };
      serviceFee?: { mode: "AMOUNT" | "PERCENT"; value: number };
      deliveryFee?: { mode: "AMOUNT" | "PERCENT"; value: number; splitMethod?: "EQUAL" | "PRO_RATA" };
      deliveryDiscount?: { mode: "AMOUNT" | "PERCENT"; value: number };
      note?: string;
    };
  } catch { throw new Error("Invalid Split Bill data."); }
}

export async function createSplitBillAction(formData: FormData) {
  await createSplitBill(parseCreatePayload(formData));
  refreshAll();
  redirect("/split-bill");
}

export async function finalizeSplitBillAction(formData: FormData) {
  const splitBillId = formData.get("splitBillId");
  const transactionDate = formData.get("transactionDate");
  const walletId = formData.get("walletId");
  if (typeof splitBillId !== "string" || !splitBillId) throw new Error("Split Bill not found.");
  if (typeof transactionDate !== "string" || !transactionDate) throw new Error("Transaction date is required.");
  if (typeof walletId !== "string" || !walletId) throw new Error("Wallet is required.");
  await finalizeSplitBill(splitBillId, { transactionDate: new Date(transactionDate), walletId });
  refreshAll();
}

export async function updateSplitBillItemAction(formData: FormData) {
  const splitBillId = formData.get("splitBillId");
  const itemId = formData.get("itemId");
  const splitMethod = formData.get("splitMethod");
  const allocations = formData.get("allocations");
  if (typeof splitBillId !== "string" || !splitBillId || typeof itemId !== "string" || !itemId) throw new Error("Split Bill item not found.");
  if (splitMethod !== "EQUAL" && splitMethod !== "PRO_RATA") throw new Error("Invalid split method.");
  if (typeof allocations !== "string") throw new Error("Item allocation data is missing.");
  let parsed: { participantId: string; units: number }[];
  try { parsed = JSON.parse(allocations); } catch { throw new Error("Invalid item allocation data."); }
  await updateSplitBillItemAllocation({ splitBillId, itemId, splitMethod, allocations: parsed });
  refreshAll();
}

export async function deleteSplitBillAction(formData: FormData) {
  const id = formData.get("splitBillId");
  if (typeof id !== "string" || !id) throw new Error("Split Bill not found.");
  await deleteSplitBill(id);
  refreshAll();
}
