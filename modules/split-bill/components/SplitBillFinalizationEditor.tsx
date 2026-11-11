"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateFinalizedSplitBillTransactionAction } from "../actions";

type Option = { id: string; name: string };
type SubcategoryOption = Option & { categoryId: string };

type Props = {
  splitBillId: string;
  transactionDate: string;
  walletId: string;
  categoryId: string;
  subcategoryId: string | null;
  note: string | null;
  wallets: Option[];
  categories: Option[];
  subcategories: SubcategoryOption[];
};

const inputClass = "w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50 disabled:opacity-50";

export default function SplitBillFinalizationEditor(props: Props) {
  const [editing, setEditing] = useState(false);
  const [transactionDate, setTransactionDate] = useState(props.transactionDate);
  const [walletId, setWalletId] = useState(props.walletId);
  const [categoryId, setCategoryId] = useState(props.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(props.subcategoryId ?? "");
  const [note, setNote] = useState(props.note ?? "");
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setTransactionDate(props.transactionDate);
    setWalletId(props.walletId);
    setCategoryId(props.categoryId);
    setSubcategoryId(props.subcategoryId ?? "");
    setNote(props.note ?? "");
  }, [props.transactionDate, props.walletId, props.categoryId, props.subcategoryId, props.note]);

  const visibleSubcategories = useMemo(
    () => props.subcategories.filter((subcategory) => subcategory.categoryId === categoryId),
    [categoryId, props.subcategories],
  );

  function cancel() {
    if (isSaving) return;
    setTransactionDate(props.transactionDate);
    setWalletId(props.walletId);
    setCategoryId(props.categoryId);
    setSubcategoryId(props.subcategoryId ?? "");
    setNote(props.note ?? "");
    setEditing(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const formData = new FormData(event.currentTarget);
    startSaving(async () => {
      try {
        await updateFinalizedSplitBillTransactionAction(formData);
        toast.success("Finalized Split Bill transaction updated.");
        setEditing(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update finalized transaction.");
      }
    });
  }

  if (!editing) {
    return <button type="button" onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:border-emerald-400/30 hover:text-emerald-300"><Pencil size={11} /> Edit finalization</button>;
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isSaving} className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] p-3">
      <input type="hidden" name="splitBillId" value={props.splitBillId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Paid on
          <input type="date" name="transactionDate" required value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} disabled={isSaving} className={`${inputClass} mt-1 normal-case tracking-normal`} />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Payment wallet
          <select name="walletId" required value={walletId} onChange={(event) => setWalletId(event.target.value)} disabled={isSaving} className={`${inputClass} mt-1 normal-case tracking-normal`}>
            {props.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Category
          <select name="categoryId" required value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} disabled={isSaving} className={`${inputClass} mt-1 normal-case tracking-normal`}>
            <option value="">Select category</option>
            {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Subcategory
          <select name="subcategoryId" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={isSaving || !categoryId} className={`${inputClass} mt-1 normal-case tracking-normal`}>
            <option value="">No subcategory</option>
            {visibleSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:col-span-2">Note
          <input name="note" value={note} onChange={(event) => setNote(event.target.value)} disabled={isSaving} className={`${inputClass} mt-1 normal-case tracking-normal`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {isSaving && <span role="status" className="mr-auto inline-flex items-center gap-1.5 text-[10px] text-emerald-200"><LoaderCircle size={12} className="animate-spin" /> Saving finalization changes…</span>}
        <button type="button" onClick={cancel} disabled={isSaving} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 disabled:opacity-50"><X size={11} /> Cancel</button>
        <button type="submit" disabled={isSaving || !transactionDate || !walletId || !categoryId} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-50">
          {isSaving ? <LoaderCircle size={11} className="animate-spin" /> : <Check size={11} />}{isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
