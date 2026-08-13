"use client";

import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { upsertBudgetItemAction } from "../actions";

type Category = { id: string; name: string };
type Subcategory = { id: string; categoryId: string; name: string };
type Props = { month: string; currencyCode: string; categories: Category[]; subcategories: Subcategory[]; initialCategoryId?: string; initialSubcategoryId?: string; initialAmount?: number };

export default function BudgetItemForm({ month, currencyCode, categories, subcategories, initialCategoryId = "", initialSubcategoryId = "", initialAmount }: Props) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [categoryId, setCategoryId] = React.useState(initialCategoryId);
  const [subcategoryId, setSubcategoryId] = React.useState(initialSubcategoryId);
  const availableSubcategories = useMemo(() => subcategories.filter((subcategory) => subcategory.categoryId === categoryId), [subcategories, categoryId]);

  async function handleSave(formData: FormData) {
    let result = await upsertBudgetItemAction(formData);
    if (!result.success && "requiresReplacement" in result && result.requiresReplacement) {
      const confirmed = window.confirm(result.message ?? "A budget already exists for this month. Replace it?");
      if (!confirmed) return;
      formData.set("replaceExisting", "true");
      result = await upsertBudgetItemAction(formData);
    }
    if (!result.success) { toast.error(result.message ?? "Failed to save budget."); return; }
    toast.success(initialAmount !== undefined ? "Budget updated successfully." : "Budget saved successfully.");
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("editing", initialAmount !== undefined ? "true" : "false");
    startSaving(() => handleSave(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
      <input type="hidden" name="month" value={month} /><input type="hidden" name="currencyCode" value={currencyCode} />
      <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Category</span><select required name="categoryId" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-200 outline-none"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Subcategory</span><select name="subcategoryId" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={!categoryId || availableSubcategories.length === 0} className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-200 outline-none disabled:opacity-40"><option value="">Entire category</option>{availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Monthly limit</span><input required min="0" step="1" name="amount" type="number" inputMode="numeric" defaultValue={initialAmount ?? ""} placeholder="500000" className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-200 outline-none" /></label>
      <button type="submit" disabled={isSaving} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#07110b] disabled:opacity-50">{isSaving ? "Saving…" : initialAmount !== undefined ? "Update budget" : "Save budget"}</button>
    </form>
  );
}
