"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteBudgetItemAction } from "../actions";
import type { BudgetItemView } from "../types";

type Props = { item: BudgetItemView; currencySymbol: string; editHref: string };

function formatMoney(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }

export default function BudgetItemRow({ item, currencySymbol, editHref }: Props) {
  const [isDeleting, startDeleting] = useTransition();
  const progress = Math.min(item.percentage, 100);
  const over = item.actualAmount > item.budgetAmount;

  function handleDelete() {
    const formData = new FormData();
    formData.set("id", item.id);
    startDeleting(async () => {
      const result = await deleteBudgetItemAction(formData);
      if (result.success) toast.success("Budget removed.");
      else toast.error(result.message ?? "Failed to remove budget.");
    });
  }

  return (
    <div className="rounded-2xl border border-[#26384B] bg-[#111C28] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.categoryName}</p>
          <p className="mt-1 text-[11px] text-slate-400">{item.subcategoryName ?? "Entire category"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold ${over ? "text-red-300" : "text-slate-100"}`}>{currencySymbol}{formatMoney(item.actualAmount)} / {currencySymbol}{formatMoney(item.budgetAmount)}</p>
          <p className={`mt-0.5 text-[10px] ${over ? "text-red-300" : "text-slate-500"}`}>{over ? `${currencySymbol}${formatMoney(Math.abs(item.remainingAmount))} over` : `${currencySymbol}${formatMoney(item.remainingAmount)} remaining`}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0A121B]"><div className={`h-full rounded-full ${over ? "bg-red-400" : item.percentage >= 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-500">
        <span>{Math.round(item.percentage)}% used</span>
        <div className="flex items-center gap-3">
          <Link href={editHref} className="text-slate-300 hover:text-white">Edit</Link>
          <button type="button" disabled={isDeleting} onClick={handleDelete} className="text-slate-500 hover:text-red-300 disabled:opacity-50">{isDeleting ? "Removing…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}
