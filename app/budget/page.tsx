import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import BudgetItemForm from "@/modules/budget/components/BudgetItemForm";
import BudgetItemRow from "@/modules/budget/components/BudgetItemRow";
import { currentMonthKey, getBudgetFormData, getBudgetOverview } from "@/modules/budget/service";

function formatMoney(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string; currency?: string }> }) {
  const params = await searchParams;
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthKey();
  const currency = params.currency || "IDR";
  const [overview, formData] = await Promise.all([getBudgetOverview(month, currency), getBudgetFormData(currency)]);
  const previous = (() => { const date = new Date(`${month}-01T00:00:00`); date.setMonth(date.getMonth() - 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; })();
  const next = (() => { const date = new Date(`${month}-01T00:00:00`); date.setMonth(date.getMonth() + 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; })();
  const totalProgress = overview.totalBudget > 0 ? Math.min((overview.totalActual / overview.totalBudget) * 100, 100) : 0;
  const overBudget = overview.totalActual > overview.totalBudget;

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Budget</h1>
            <p className="mt-2 text-slate-400">Set monthly spending limits and see how your actual expenses track against them.</p>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="block"><span className="mb-1 block text-[9px] uppercase tracking-[0.12em] text-slate-500">Month</span><input type="month" name="month" defaultValue={month} className="rounded-xl border border-white/10 bg-[#0d141e] px-3 py-2.5 text-sm text-slate-200" /></label>
            <label className="block"><span className="mb-1 block text-[9px] uppercase tracking-[0.12em] text-slate-500">Currency</span><select name="currency" defaultValue={overview.currency.code} className="rounded-xl border border-white/10 bg-[#0d141e] px-3 py-2.5 text-sm text-slate-200">{formData.currencies.map((item) => <option key={item.id} value={item.code}>{item.code}</option>)}</select></label>
            <button type="submit" className="rounded-xl border border-white/10 bg-[#0d141e] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.04]">View</button>
          </form>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0d141e] px-4 py-3">
          <Link href={`/budget?month=${previous}&currency=${overview.currency.code}`} className="text-sm text-slate-400 hover:text-white">← Previous</Link>
          <div className="text-center"><p className="text-sm font-semibold text-white">{overview.name.replace("Budget ", "")}</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-600">Monthly plan</p></div>
          <Link href={`/budget?month=${next}&currency=${overview.currency.code}`} className="text-sm text-slate-400 hover:text-white">Next →</Link>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-[18px] border border-[#26384B] bg-[#0E1722] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Budget</p><p className="mt-1 text-xl font-semibold text-white">{overview.currency.symbol}{formatMoney(overview.totalBudget)}</p></div>
          <div className="rounded-[18px] border border-[#26384B] bg-[#0E1722] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Actual spending</p><p className="mt-1 text-xl font-semibold text-white">{overview.currency.symbol}{formatMoney(overview.totalActual)}</p></div>
          <div className={`rounded-[18px] border px-4 py-4 ${overBudget ? "border-red-400/20 bg-[#211416]" : "border-emerald-400/15 bg-[#0E1722]"}`}><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{overBudget ? "Over budget" : "Remaining"}</p><p className={`mt-1 text-xl font-semibold ${overBudget ? "text-red-300" : "text-emerald-300"}`}>{overview.currency.symbol}{formatMoney(Math.abs(overview.totalRemaining))}</p></div>
          <div className="rounded-[18px] border border-amber-400/20 bg-[#171B1C] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Unbudgeted spending</p><p className="mt-1 text-xl font-semibold text-amber-300">{overview.currency.symbol}{formatMoney(overview.unbudgetedActual)}</p></div>
        </section>

        <section className="rounded-[20px] border border-[#26384B] bg-[#0D1722] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Monthly progress</p><h2 className="mt-1 text-lg font-semibold text-white">{Math.round(totalProgress)}% of planned budget used</h2></div><p className="text-xs text-slate-500">{overview.items.length} budget {overview.items.length === 1 ? "item" : "items"}</p></div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#091018]"><div className={`h-full rounded-full ${overBudget ? "bg-red-400" : totalProgress >= 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${totalProgress}%` }} /></div>
        </section>

        <section className="rounded-[20px] border border-[#26384B] bg-[#0D1722] p-5 md:p-6">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Add or update budget</p><h2 className="mt-1 text-lg font-semibold text-white">Set a limit for a category or subcategory</h2><p className="mt-1 text-xs text-slate-500">A category budget covers all of its subcategories. Do not mix category-level and subcategory-level budgets for the same category.</p></div>
          <div className="mt-5"><BudgetItemForm month={month} currencyCode={overview.currency.code} categories={formData.categories} subcategories={formData.subcategories} /></div>
        </section>

        <section className="space-y-3">
          {overview.items.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0d141e] p-10 text-center"><p className="text-sm font-semibold text-white">No budgets for this month yet</p><p className="mt-1 text-xs text-slate-500">Add a category limit above to start tracking your spending.</p></div>
          ) : overview.items.map((item) => <BudgetItemRow key={item.id} item={item} currencySymbol={overview.currency.symbol} />)}
        </section>
      </div>
    </AppShell>
  );
}
