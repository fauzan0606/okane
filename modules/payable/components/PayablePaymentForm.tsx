"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { recordPayablePaymentAction } from "../actions";

type Option = { id: string; name: string };
type SubcategoryOption = Option & { categoryId: string };

type Props = {
  payableId: string;
  personName: string;
  merchantName: string;
  amount: number;
  paidAmount: number;
  symbol: string;
  today: string;
  wallets: { id: string; name: string; currency: { code: string } }[];
  categories: Option[];
  subcategories: SubcategoryOption[];
};

function inputClass() {
  return "w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50";
}
function money(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export default function PayablePaymentForm({
  payableId,
  personName,
  merchantName,
  amount,
  paidAmount,
  symbol,
  today,
  wallets,
  categories,
  subcategories,
}: Props) {
  const router = useRouter();
  const [amountTransferred, setAmountTransferred] = useState(String(Math.max(amount - paidAmount, 0)));
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const remaining = Math.max(amount - paidAmount, 0);
  const transferValue = Number(amountTransferred);
  const excessPreview = Number.isFinite(transferValue) ? Math.max(transferValue - remaining, 0) : 0;
  const visibleSubcategories = useMemo(
    () => subcategories.filter((subcategory) => subcategory.categoryId === categoryId),
    [categoryId, subcategories],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (saving) return;
    setSaving(true);
    const result = await recordPayablePaymentAction(new FormData(event.currentTarget));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const excess = Number(result.excessAmount);
    setMessage(
      excess > 0
        ? `Payment recorded: ${money(Number(result.appliedAmount), symbol)} applied to the debt, ${money(excess, symbol)} recorded as overpayment.`
        : "Payment recorded and the outstanding amount has been updated.",
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-amber-400/10 bg-amber-400/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Record repayment to {personName}</p>
          <p className="mt-1 text-[10px] text-slate-500">{merchantName} · Outstanding {money(remaining, symbol)}</p>
        </div>
        <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.04] px-2.5 py-1 text-[9px] font-semibold text-amber-300">PAYABLE</span>
      </div>

      <input type="hidden" name="payableId" value={payableId} />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Amount owed</label>
          <input value={money(remaining, symbol)} readOnly className={`${inputClass()} text-slate-400`} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300">Amount transferred</label>
          <input name="amountTransferred" value={amountTransferred} onChange={(event) => setAmountTransferred(event.target.value)} inputMode="decimal" min="0.01" step="0.01" required className={inputClass()} placeholder="e.g. 186000" />
          <p className="mt-1 text-[10px] text-slate-600">
            {excessPreview > 0 ? `Overpayment ${money(excessPreview, symbol)} will not increase the debt settlement.` : "This is the amount that will actually leave your wallet."}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Payment date</label>
          <input type="date" name="paymentDate" defaultValue={today} required className={inputClass()} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Payment wallet</label>
          <select name="walletId" required className={inputClass()}>
            <option value="">Select wallet</option>
            {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Expense category</label>
          <select name="categoryId" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} required className={inputClass()}>
            <option value="">Select category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Expense subcategory</label>
          <select name="subcategoryId" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={!categoryId} className={inputClass()}>
            <option value="">{categoryId ? "Select subcategory" : "Select category first"}</option>
            {visibleSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Note</label>
        <input name="note" className={inputClass()} placeholder={`Repayment to ${personName} · ${merchantName}`} />
      </div>

      {error && <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-3 py-2 text-xs text-red-300">{error}</p>}
      {message && <p className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2 text-xs text-emerald-300">{message}</p>}

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Recording..." : "Record Payment"}
        </button>
      </div>
    </form>
  );
}
