"use server";

import { revalidatePath } from "next/cache";
import { ReconciliationResolution } from "@prisma/client";
import { completeReconciliation, resolveReconciliationRow } from "./service";

function refreshAll() {
  revalidatePath("/reconciliation");
  revalidatePath("/transactions");
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
  revalidatePath("/");
}

export async function resolveReconciliationRowAction(formData: FormData) {
  const rowId = formData.get("rowId");
  const resolution = formData.get("resolution");
  if (typeof rowId !== "string" || !rowId) throw new Error("Reconciliation row is required.");
  if (typeof resolution !== "string" || !Object.values(ReconciliationResolution).includes(resolution as ReconciliationResolution)) throw new Error("Invalid reconciliation resolution.");
  await resolveReconciliationRow({ rowId, resolution: resolution as ReconciliationResolution });
  refreshAll();
}

export async function completeReconciliationAction(formData: FormData) {
  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string" || !sessionId) throw new Error("Reconciliation session is required.");
  await completeReconciliation(sessionId);
  refreshAll();
}
