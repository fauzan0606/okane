"use client";

import { useMemo, useState } from "react";
import { finalizeSplitBillAction } from "../actions";

type Option = { id: string; name: string };
type SubcategoryOption = Option & { categoryId: string };

type Props = {
  splitBillId: string;
  today: string;
  payerName: string;
  payerIsMe: boolean;
  wallets: { id: string; name: string; currency: { code: string } }[];
  categories: Option[];
  subcategories: SubcategoryOption[];
  recommendedCategoryId: string | null;
  recommendedSubcategoryId: string | null;
  recommendationConfidence: "HIGH" | "MEDIUM" | "NONE";
};

function inputClass() {
  return "w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50";
}

export default function SplitBillFinalizeForm({
  splitBillId,
  today,
  payerName,
  payerIsMe,
  wallets,
  categories,
  subcategories,
  recommendedCategoryId,
  recommendedSubcategoryId,
  recommendationConfidence,
}: Props) {
  const [categoryId, setCategoryId] = useState(recommendedCategoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(recommendedSubcategoryId ?? "");
  const visibleSubcategories = useMemo(
    () => subcategories.filter((subcategory) => subcategory.categoryId === categoryId),
    [categoryId, subcategories],
  );

  return (
    <form action={finalizeSplitBillAction} className="mt-4 space-y-3">
      <input type="hidden" name="splitBillId" value={splitBillId} />
      <div className="grid gap-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">Paid on</label>
          <input type="date" name="transactionDate" defaultValue={today} required className={inputClass()} />
        </div>
        {payerIsMe ? (
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">Payment wallet</label>
            <select name="walletId" required className={inputClass()}><option value="">Select wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}</select>
          </div>
        ) : (
          <div className="lg:col-span-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.03] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300">Paid by {payerName}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">No expense will be created from your wallet. The Split Bill is recorded as an amount you owe {payerName}; after finalization, use the repayment form below when you actually transfer money to them.</p>
          </div>
        )}
        {payerIsMe && (
          <>
            <select name="categoryId" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass()}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.id === recommendedCategoryId ? " · Recommended" : ""}</option>)}</select>
            <select name="subcategoryId" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={!categoryId} className={inputClass()}><option value="">{categoryId ? "Select subcategory" : "Select category first"}</option>{visibleSubcategories.filter((subcategory) => subcategory.categoryId === categoryId).map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}{subcategory.id === recommendedSubcategoryId && categoryId === recommendedCategoryId ? " · Recommended" : ""}</option>)}</select>
          </>
        )}
      </div>
      {payerIsMe && recommendationConfidence !== "NONE" && Boolean(recommendedCategoryId) && <p className="text-[10px] text-emerald-300/80">Category suggestion is based on your Smart Transaction learning for this merchant. You can change it before saving.</p>}
      <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-[#07110b]">{payerIsMe ? "Finalize & Add to Finance" : "Finalize Split Bill"}</button>
    </form>
  );
}
