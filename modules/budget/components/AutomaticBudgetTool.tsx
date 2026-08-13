"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getBudgetSuggestionAction, applyBudgetSuggestionAction } from "../actions";
import type { BudgetSuggestion } from "../types";

type Props = { month: string; currencyCode: string; currencySymbol: string };
function money(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }

export default function AutomaticBudgetTool({ month, currencyCode, currencySymbol }: Props) {
  const [mode, setMode] = useState<"OVERALL" | "CATEGORY" | null>(null);
  const [suggestion, setSuggestion] = useState<BudgetSuggestion | null>(null);
  const [busy, start] = useTransition();
  const calculate = () => { if (!mode) return; start(async () => { const form = new FormData(); form.set("month", month); form.set("currencyCode", currencyCode); const result = await getBudgetSuggestionAction(form); if (!result.success) { toast.error(result.message ?? "Failed to calculate budget."); return; } setSuggestion(result.suggestion); }); };
  const apply = () => {
    if (!suggestion || !mode) return;
    start(async () => {
      const form = new FormData(); form.set("suggestion", JSON.stringify(suggestion)); form.set("mode", mode);
      let result = await applyBudgetSuggestionAction(form);
      if (!result.success && "requiresReplacement" in result && result.requiresReplacement) {
        if (!window.confirm(result.message ?? "A budget already exists for this month. Replace it?")) return;
        form.set("replaceExisting", "true");
        result = await applyBudgetSuggestionAction(form);
      }
      if (!result.success) { toast.error(result.message ?? "Failed to apply budget."); return; }
      toast.success(mode === "OVERALL" ? "Automatic overall budget applied." : "Automatic category budgets applied."); setSuggestion(null);
    });
  };
  return (
    <section className="rounded-[20px] border border-blue-400/15 bg-[#0D1722] p-5 md:p-6">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300">Automatic planner</p><h2 className="mt-1 text-lg font-semibold text-white">Calculate a budget automatically</h2><p className="mt-1 max-w-2xl text-xs text-slate-500">Uses income, recent spending history and the previous month’s budget. Nothing is saved until you approve the result.</p></div>
      {!mode ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2"><button type="button" onClick={() => setMode("OVERALL")} className="rounded-2xl border border-blue-400/15 bg-[#111C28] p-5 text-left transition hover:border-blue-400/30 hover:bg-[#132131]"><p className="text-sm font-semibold text-white">Overall budget</p><p className="mt-1 text-xs text-slate-500">Calculate one monthly limit for all expense categories combined.</p></button><button type="button" onClick={() => setMode("CATEGORY")} className="rounded-2xl border border-blue-400/15 bg-[#111C28] p-5 text-left transition hover:border-blue-400/30 hover:bg-[#132131]"><p className="text-sm font-semibold text-white">Per category</p><p className="mt-1 text-xs text-slate-500">Calculate separate recommendations for each expense category.</p></button></div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-[#091018] p-1"><button type="button" onClick={() => { setMode("OVERALL"); setSuggestion(null); }} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${mode === "OVERALL" ? "bg-blue-500/20 text-blue-200" : "text-slate-400"}`}>Overall budget</button><button type="button" onClick={() => { setMode("CATEGORY"); setSuggestion(null); }} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${mode === "CATEGORY" ? "bg-blue-500/20 text-blue-200" : "text-slate-400"}`}>Per category</button><button type="button" onClick={() => { setMode(null); setSuggestion(null); }} className="px-3 py-2 text-xs text-slate-500 hover:text-white">Change</button></div>
          {!suggestion ? <div className="mt-4 rounded-2xl border border-white/10 bg-[#111C28] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{mode === "OVERALL" ? "Overall budget recommendation" : "Category budget recommendations"}</p><p className="mt-1 text-xs text-slate-500">Review the calculation before applying it to this month.</p></div><button type="button" onClick={calculate} disabled={busy} className="rounded-xl bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Calculating…" : mode === "CATEGORY" ? "Calculate categories" : "Calculate overall"}</button></div></div> : <div className="mt-4 rounded-2xl border border-white/10 bg-[#111C28] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{mode === "CATEGORY" ? "Adjust category recommendations" : "Adjust overall recommendation"}</p><p className="mt-1 text-xs text-slate-500">These values are recommendations. You can change them before approving.</p></div><button type="button" onClick={calculate} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50">Recalculate</button></div><div className="mt-4 grid gap-3 md:grid-cols-4"><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Income estimate</p><p className="mt-1 text-sm font-semibold text-white">{currencySymbol}{money(suggestion.incomeEstimate)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Historical spending</p><p className="mt-1 text-sm font-semibold text-white">{currencySymbol}{money(suggestion.historicalExpenseAverage)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Previous budget</p><p className="mt-1 text-sm font-semibold text-white">{currencySymbol}{money(suggestion.previousBudgetTotal)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Recommended total</p><p className="mt-1 text-sm font-semibold text-emerald-300">{currencySymbol}{money(suggestion.recommendedTotalBudget)}</p></div></div><p className="mt-3 text-[10px] text-slate-500">Confidence: <span className="font-semibold text-slate-300">{suggestion.confidence}</span></p>{mode === "OVERALL" ? <div className="mt-4 rounded-xl border border-blue-400/10 bg-[#0D1722] p-3"><label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Budget amount</span><input type="number" min="0" step="1000" value={suggestion.recommendedTotalBudget} onChange={(event) => setSuggestion({ ...suggestion, recommendedTotalBudget: Number(event.target.value) || 0 })} className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-200 outline-none" /></label></div> : <div className="mt-4 rounded-xl border border-blue-400/10 bg-[#0D1722] p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-white">Category recommendations</p><p className="text-[10px] text-slate-500">Review and adjust before applying</p></div><div className="mt-3 space-y-2">{suggestion.items.map((item, index) => <div key={item.categoryId ?? `item-${index}`} className="grid gap-3 rounded-xl border border-white/5 bg-[#111C28] px-3 py-3 md:grid-cols-[1fr_auto]"><div><p className="text-xs font-semibold text-white">{item.categoryName}</p><p className="mt-1 text-[10px] text-slate-500">History {currencySymbol}{money(item.historicalAverage)} · Previous budget {currencySymbol}{money(item.previousBudget)}</p></div><div className="flex items-center gap-2"><span className="text-[9px] uppercase tracking-[0.1em] text-slate-500">Budget</span><input type="number" min="0" step="1000" value={item.recommendedAmount} onChange={(event) => { const items = [...suggestion.items]; items[index] = { ...items[index], recommendedAmount: Number(event.target.value) || 0 }; setSuggestion({ ...suggestion, items }); }} className="w-36 rounded-lg border border-white/10 bg-[#070c12] px-2.5 py-2 text-sm text-slate-200 outline-none" /></div></div>)}</div></div>}<div className="mt-4 flex justify-end"><button type="button" onClick={apply} disabled={busy} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-[#07110b] disabled:opacity-50">{busy ? "Applying…" : mode === "OVERALL" ? "Use this overall budget" : "Use these category budgets"}</button></div></div>}
        </>
      )}
    </section>
  );
}
