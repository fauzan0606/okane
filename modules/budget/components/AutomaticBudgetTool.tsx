"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getBudgetSuggestionAction, applyBudgetSuggestionAction } from "../actions";
import type { BudgetSuggestion } from "../types";

type Props = { month: string; currencyCode: string; currencySymbol: string };
function money(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }

export default function AutomaticBudgetTool({ month, currencyCode, currencySymbol }: Props) {
  const [mode, setMode] = useState<"OVERALL" | "CATEGORY">("OVERALL");
  const [suggestion, setSuggestion] = useState<BudgetSuggestion | null>(null);
  const [busy, start] = useTransition();
  const calculate = () => start(async () => {
    const form = new FormData(); form.set("month", month); form.set("currencyCode", currencyCode);
    const result = await getBudgetSuggestionAction(form);
    if (!result.success) { toast.error(result.message ?? "Failed to calculate budget."); return; }
    setSuggestion(result.suggestion);
  });
  const apply = () => {
    if (!suggestion) return;
    start(async () => {
      const form = new FormData(); form.set("suggestion", JSON.stringify(suggestion)); form.set("mode", mode);
      const result = await applyBudgetSuggestionAction(form);
      if (!result.success) { toast.error(result.message ?? "Failed to apply budget."); return; }
      toast.success(mode === "OVERALL" ? "Automatic overall budget applied." : "Automatic category budgets applied.");
      setSuggestion(null);
    });
  };
  return <section className="rounded-[20px] border border-blue-400/15 bg-[#0D1722] p-5 md:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300">Automatic planner</p><h2 className="mt-1 text-lg font-semibold text-white">Calculate a budget automatically</h2><p className="mt-1 max-w-2xl text-xs text-slate-500">Uses income, recent spending history and the previous month’s budget. Nothing is saved until you approve the result.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setMode("OVERALL"); setSuggestion(null); }} className={`rounded-xl px-3 py-2 text-xs font-semibold ${mode === "OVERALL" ? "bg-blue-500/20 text-blue-200" : "border border-white/10 text-slate-400"}`}>Overall budget</button><button type="button" onClick={() => { setMode("CATEGORY"); setSuggestion(null); }} className={`rounded-xl px-3 py-2 text-xs font-semibold ${mode === "CATEGORY" ? "bg-blue-500/20 text-blue-200" : "border border-white/10 text-slate-400"}`}>Per category</button><button type="button" onClick={calculate} disabled={busy} className="rounded-xl bg-blue-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Calculating…" : mode === "CATEGORY" ? "Calculate categories" : "Calculate overall"}</button></div>
    </div>
    {suggestion && <div className="mt-5 rounded-2xl border border-white/10 bg-[#111C28] p-4">
      <div className="grid gap-3 md:grid-cols-4"><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Income estimate</p><p className="mt-1 text-sm font-semibold text-white">{currencySymbol}{money(suggestion.incomeEstimate)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Historical spending</p><p className="mt-1 text-sm font-semibold text-white">{currencySymbol}{money(suggestion.historicalExpenseAverage)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Previous budget</p><p className="mt-1 text-sm font-semibold text-white">{currencySymbol}{money(suggestion.previousBudgetTotal)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Recommended total</p><p className="mt-1 text-sm font-semibold text-emerald-300">{currencySymbol}{money(suggestion.recommendedTotalBudget)}</p></div></div>
      <p className="mt-3 text-[10px] text-slate-500">Confidence: <span className="font-semibold text-slate-300">{suggestion.confidence}</span></p>
      {mode === "CATEGORY" && <div className="mt-4 rounded-xl border border-blue-400/10 bg-[#0D1722] p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-white">Category recommendations</p><p className="text-[10px] text-slate-500">Review before applying</p></div><div className="mt-3 space-y-2">{suggestion.items.map((item) => <div key={item.categoryId} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/5 bg-[#111C28] px-3 py-3"><div><p className="text-xs font-semibold text-white">{item.categoryName}</p><p className="mt-1 text-[10px] text-slate-500">History {currencySymbol}{money(item.historicalAverage)} · Previous budget {currencySymbol}{money(item.previousBudget)}</p></div><div className="text-right"><p className="text-[9px] uppercase tracking-[0.1em] text-slate-500">Recommended</p><p className="mt-0.5 text-sm font-semibold text-emerald-300">{currencySymbol}{money(item.recommendedAmount)}</p></div></div>)}</div></div>}
      <div className="mt-4 flex justify-end"><button type="button" onClick={apply} disabled={busy} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-[#07110b] disabled:opacity-50">{busy ? "Applying…" : mode === "OVERALL" ? "Use this overall budget" : "Use these category budgets"}</button></div>
    </div>}
  </section>;
}
