"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearCategoryBudgetsAction } from "../actions";

type Props = { month: string; currencyCode: string };

export default function BudgetCategoryActions({ month, currencyCode }: Props) {
  const router = useRouter();
  const [deleting, startDeleting] = useTransition();
  function handleDelete() {
    if (!window.confirm("Delete all category budgets for this month? This cannot be undone.")) return;
    const formData = new FormData();
    formData.set("month", month);
    formData.set("currencyCode", currencyCode);
    startDeleting(async () => {
      const result = await clearCategoryBudgetsAction(formData);
      if (!result.success) { toast.error(result.message ?? "Failed to delete category budgets."); return; }
      toast.success("All category budgets deleted.");
      router.refresh();
    });
  }
  return <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/5 disabled:opacity-50">{deleting ? "Deleting…" : "Delete all budgets"}</button>;
}
