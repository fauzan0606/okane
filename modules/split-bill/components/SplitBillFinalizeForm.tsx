"use client";

import { useMemo, useState } from "react";
import { finalizeSplitBillAction } from "../actions";

type Option = { id: string; name: string };
type SubcategoryOption = Option & { categoryId: string };

type Props = {
  splitBillId: string;
  today: string;
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

export default function SplitBillFinalizeForm({ splitBillId, today, wallets, categories, subcategories, recommendedCategoryId, recommendedSubcategoryId, recommendationConfidence }: Props) {
  const [categoryId, setCategoryId] = useState(recommendedCategoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(recommendedSubcategoryId ?? "");
  const visibleSubcategories = useMemo(() => subcategories.filter((subcategory) => subcategory.categoryId === categoryId), [categoryId, subcategories]);
  const hasRecommendation = recommendationConfidence !== "NONE" && Boolean(recommendedCategoryId);

  return <form action={finalizeSplitBillAction} className="mt-4 space-y-3">
    <input type="hidden" name="splitBillId" value={splitBillId} />
    <div className="grid gap-2 lg:grid-cols-4">
      <input type="date" name="transactionDate" defaultValue={today} required className={inputClass()} />
      <select name="walletId" required className={inputClass()}><option value="">Select wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}</select>
      <select name="categoryId" required value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} className={inputClass()}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.id === recommendedCategoryId ? " · Recommended" : ""}</option>)}</select>
      <select name="subcategoryId" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={!categoryId} className={inputClass()}><option value="">{categoryId ? "Select subcategory" : "Select category first"}</option>{visibleSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}{subcategory.id === recommendedSubcategoryId && categoryId === recommendedCategoryId ? " · Recommended" : ""}</option>)}</select>
    </div>
    {hasRecommendation && <p className="text-[10px] text-emerald-300/80">Category suggestion is based on your Smart Transaction learning for this merchant{recommendationConfidence === "HIGH" ? ", including subcategory history" : ""}. You can change it before saving.</p>}
    <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-[#07110b]">Finalize &amp; Add to Finance</button>
  </form>;
}
