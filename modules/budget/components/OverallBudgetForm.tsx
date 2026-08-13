"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { clearOverallBudgetAction, upsertOverallBudgetAction } from "../actions";

type Props = { month: string; currencyCode: string; currentAmount: number | null; currencySymbol: string };
function formatMoney(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }

export default function OverallBudgetForm({ month, currencyCode, currentAmount, currencySymbol }: Props) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  async function save(data: FormData) {
    let result = await upsertOverallBudgetAction(data);
    if (!result.success && "requiresReplacement" in result && result.requiresReplacement) {
      const confirmed = window.confirm(result.message ?? "A budget already exists for this month. Replace it?");
      if (!confirmed) return;
      data.set("replaceExisting", "true");
      result = await upsertOverallBudgetAction(data);
    }
    if (!result.success) { toast.error(result.message ?? "Failed to save overall budget."); return; }
    toast.success(currentAmount !== null ? "Overall budget updated successfully." : "Overall budget saved successfully.");
    router.refresh();
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("editing", currentAmount !== null ? "true" : "false");
    startSaving(() => save(data));
  }
  function remove() {
    const data = new FormData(); data.set("month", month); data.set("currencyCode", currencyCode);
    startDeleting(async () => {
      const result = await clearOverallBudgetAction(data);
      if (!result.success) { toast.error(result.message ?? "Failed to delete overall budget."); return; }
      toast.success("Overall budget deleted.");
      router.refresh();
    });
  }
  return <div className="rounded-2xl border border-emerald-400/15 bg-[#101A26] p-4">
    <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">Overall monthly budget</p><p className="mt-1 text-[11px] text-slate-500">One limit for all expense categories combined.</p></div>
      <input type="hidden" name="month" value={month} /><input type="hidden" name="currencyCode" value={currencyCode} />
      <label className="block w-full md:w-56"><span className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-slate-500">Amount</span><input required min="0" step="1" name="amount" type="number" defaultValue={currentAmount ?? ""} placeholder="5000000" className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-200 outline-none" /></label>
      <button type="submit" disabled={saving || deleting} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#07110b] disabled:opacity-50">{saving ? "Saving…" : currentAmount !== null ? "Update overall" : "Save overall"}</button>
      {currentAmount !== null && <button type="button" onClick={remove} disabled={saving || deleting} className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-50">{deleting ? "Deleting…" : "Delete"}</button>}
    </form>
    {currentAmount !== null && <p className="mt-2 text-[10px] text-slate-500">Current: {currencySymbol}{formatMoney(currentAmount)}</p>}
  </div>;
}
