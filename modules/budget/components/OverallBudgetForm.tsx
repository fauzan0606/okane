"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { upsertOverallBudgetAction } from "../actions";

type Props = { month: string; currencyCode: string; currentAmount: number | null; currencySymbol: string };

function formatMoney(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }

export default function OverallBudgetForm({ month, currencyCode, currentAmount, currencySymbol }: Props) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startSaving(async () => {
      const result = await upsertOverallBudgetAction(data);
      if (!result.success) { toast.error(result.message ?? "Failed to save overall budget."); return; }
      toast.success("Overall budget saved successfully.");
      router.refresh();
    });
  }
  return <form onSubmit={submit} className="rounded-2xl border border-emerald-400/15 bg-[#101A26] p-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">Overall monthly budget</p><p className="mt-1 text-[11px] text-slate-500">One limit for all expense categories combined.</p></div>
      <input type="hidden" name="month" value={month} /><input type="hidden" name="currencyCode" value={currencyCode} />
      <label className="block w-full md:w-56"><span className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-slate-500">Amount</span><input required min="1" step="1" name="amount" type="number" defaultValue={currentAmount ?? ""} placeholder="5000000" className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-200 outline-none" /></label>
      <button type="submit" disabled={saving} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#07110b] disabled:opacity-50">{saving ? "Saving…" : "Save overall"}</button>
    </div>
    {currentAmount !== null && <p className="mt-2 text-[10px] text-slate-500">Current: {currencySymbol}{formatMoney(currentAmount)}</p>}
  </form>;
}
