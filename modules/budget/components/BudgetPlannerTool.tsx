"use client";

import { useState } from "react";
import AutomaticBudgetTool from "./AutomaticBudgetTool";
import ManualBudgetTool from "./ManualBudgetTool";

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

type PlannerMode = "AUTOMATIC" | "MANUAL" | null;

export default function BudgetPlannerTool(props: Props) {
  const [plannerMode, setPlannerMode] = useState<PlannerMode>(props.initialAmount !== undefined ? "MANUAL" : null);

  return (
    <section className="rounded-[20px] border border-[#26384B] bg-[#0D1722] p-5 md:p-6">
      {!plannerMode ? (
        <>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Create budget</p>
            <h2 className="mt-1 text-lg font-semibold text-white">How would you like to create your budget?</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">Choose automatic planning from your income and history, or enter the budget yourself.</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => setPlannerMode("AUTOMATIC")} className="rounded-2xl border border-blue-400/15 bg-[#111C28] p-5 text-left transition hover:border-blue-400/30 hover:bg-[#132131]">
              <p className="text-sm font-semibold text-white">Automatic</p>
              <p className="mt-1 text-xs text-slate-500">Use income, spending history and previous budgets to generate a recommendation you can adjust before applying.</p>
            </button>
            <button type="button" onClick={() => setPlannerMode("MANUAL")} className="rounded-2xl border border-emerald-400/15 bg-[#111C28] p-5 text-left transition hover:border-emerald-400/30 hover:bg-[#132131]">
              <p className="text-sm font-semibold text-white">Manual</p>
              <p className="mt-1 text-xs text-slate-500">Enter your own budget, either as one overall monthly limit or by category/subcategory.</p>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Create budget</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{plannerMode === "AUTOMATIC" ? "Automatic budget" : "Manual budget"}</h2>
            </div>
            <button type="button" onClick={() => setPlannerMode(null)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white">Change method</button>
          </div>
          {plannerMode === "AUTOMATIC" ? <AutomaticBudgetTool {...props} /> : <ManualBudgetTool {...props} />}
        </>
      )}
    </section>
  );
}
