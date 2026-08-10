"use server";

import { revalidatePath } from "next/cache";
import { createSplitBill, deleteSplitBill, finalizeSplitBill } from "./service";

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
    return JSON.parse(value) as { merchantName: string; participants: { name: string; isMe: boolean }[]; items: { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] }[]; note?: string };
  } catch { throw new Error("Invalid Split Bill data."); }
}

export async function createSplitBillAction(formData: FormData) {
  await createSplitBill(parseCreatePayload(formData));
  refreshAll();
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

export async function deleteSplitBillAction(formData: FormData) {
  const id = formData.get("splitBillId");
  if (typeof id !== "string" || !id) throw new Error("Split Bill not found.");
  await deleteSplitBill(id);
  refreshAll();
}
