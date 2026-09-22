"use server";

import { revalidatePath } from "next/cache";
import { createSplitBill, deleteSplitBill, finalizeSplitBill } from "./service";
import { updateSplitBillItemAllocation } from "./item-edit-service";
import { recordPayablePayment } from "@/modules/payable/service";

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
      mode?: "PERSONAL" | "OTHERS_ONLY";
      participants: { name: string; isMe: boolean }[];
      payerParticipantIndex?: number;
      items: { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] }[];
      tax?: { mode: "AMOUNT" | "PERCENT"; value: number; treatment?: "INCLUDED" | "EXCLUDED" | "UNKNOWN" };
      serviceFee?: { mode: "AMOUNT" | "PERCENT"; value: number; treatment?: "INCLUDED" | "EXCLUDED" | "UNKNOWN" };
      deliveryFee?: { mode: "AMOUNT" | "PERCENT"; value: number; splitMethod?: "EQUAL" | "PRO_RATA" };
      deliveryDiscount?: { mode: "AMOUNT" | "PERCENT"; value: number };
      note?: string;
    };
  } catch { throw new Error("Invalid Split Bill data."); }
}

export async function createSplitBillAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await createSplitBill(parseCreatePayload(formData));
    refreshAll();
    return { ok: true };
  } catch (error) {
    console.error("createSplitBillAction failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to save Split Bill.",
    };
  }
}

export async function finalizeSplitBillAction(formData: FormData) {
  const splitBillId = formData.get("splitBillId");
  const transactionDate = formData.get("transactionDate");
  const walletId = formData.get("walletId");
  const amountTransferred = formData.get("amountTransferred");
  const categoryId = formData.get("categoryId");
  const subcategoryId = formData.get("subcategoryId");
  const note = formData.get("note");

  if (typeof splitBillId !== "string" || !splitBillId) throw new Error("Split Bill not found.");
  if (typeof transactionDate !== "string" || !transactionDate) throw new Error("Payment date is required.");
  if (typeof walletId !== "string" || !walletId) throw new Error("Payment wallet is required.");
  if (typeof categoryId !== "string" || !categoryId) throw new Error("Expense category is required.");
  const parsedAmountTransferred = typeof amountTransferred === "string" && amountTransferred ? Number(amountTransferred) : undefined;
  if (parsedAmountTransferred !== undefined && (!Number.isFinite(parsedAmountTransferred) || parsedAmountTransferred <= 0)) {
    throw new Error("Transferred amount must be greater than zero.");
  }

  const result = await finalizeSplitBill(splitBillId, {
    transactionDate: new Date(transactionDate),
    walletId: typeof walletId === "string" && walletId ? walletId : undefined,
    categoryId: typeof categoryId === "string" && categoryId ? categoryId : undefined,
    subcategoryId: typeof subcategoryId === "string" && subcategoryId ? subcategoryId : undefined,
  });

  if ("payableId" in result) {
    if (parsedAmountTransferred === undefined) throw new Error("Transferred amount is required when recording repayment.");

    await recordPayablePayment({
      payableId: result.payableId,
      amountTransferred: parsedAmountTransferred,
      paymentDate: new Date(transactionDate),
      walletId,
      categoryId,
      subcategoryId: typeof subcategoryId === "string" && subcategoryId ? subcategoryId : undefined,
      note: typeof note === "string" ? note : undefined,
    });
  }

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
