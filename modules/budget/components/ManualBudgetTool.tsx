"use client";

import { useState } from "react";
import OverallBudgetForm from "./OverallBudgetForm";
import BudgetItemForm from "./BudgetItemForm";

type Category = { id: string; name: string };
type Subcategory = { id: string; categoryId: string; name: string };
type Props = {
  month: string;
  currencyCode: string;
  currencySymbol: string;
  currentOverall: number | null;
  categories: Category[];
  subcategories: Subcategory[];
  initialCategoryId?: string;
  initialSubcategoryId?: string;
  initialAmount?: number;
};

export default function ManualBudgetTool({ month, currencyCode, currencySymbol, currentOverall, categories, subcategories, initialCategoryId, initialSubcategoryId, initialAmount }: Props) {
  const [mode, setMode] = useState<"OVERALL" | "CATEGORY">(initialAmount !== undefined ? "CATEGORY" : currentOverall !== null ? "OVERALL" : "OVERALL");
  return <section className="rounded-[20px] border border-[#26384B] bg-[#0D1722] p-5 md:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Manual budget</p><h2 className="mt-1 text-lg font-semibold text-white">Set your own budget</h2><p className="mt-1 text-xs text-slate-500">Choose whether one amount controls all spending or limits are set by category/subcategory.</p></div>
      <div className="flex rounded-xl border border-white/10 bg-[#091018] p-1">
        <button type="button" onClick={() => setMode("OVERALL")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === "OVERALL" ? "bg-emerald-500 text-[#07110b]" : "text-slate-400"}`}>Overall</button>
        <button type="button" onClick={() => setMode("CATEGORY")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === "CATEGORY" ? "bg-emerald-500 text-[#07110b]" : "text-slate-400"}`}>Per category</button>
      </div>
    </div>
    <div className="mt-5">{mode === "OVERALL" ? <OverallBudgetForm month={month} currencyCode={currencyCode} currentAmount={currentOverall} currencySymbol={currencySymbol} /> : <BudgetItemForm month={month} currencyCode={currencyCode} categories={categories} subcategories={subcategories} initialCategoryId={initialCategoryId} initialSubcategoryId={initialSubcategoryId} initialAmount={initialAmount} />}</div>
  </section>;
}
