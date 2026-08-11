"use client";

import { useActionState, useState } from "react";
import { CircleDollarSign, Info, Plus } from "lucide-react";
import { createReceivableAction } from "../actions";

type Currency = { id: string; code: string; symbol: string };
type Wallet = { id: string; name: string; walletType: string; currency: { code: string } };

const initialState = { success: false } as { success: boolean; message?: string; fieldErrors?: Record<string, string[]> };
const inputClass = "rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600";
const selectClass = "rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none";

export default function ReceivableForm({ currencies, wallets, defaultCurrencyId, today }: { currencies: Currency[]; wallets: Wallet[]; defaultCurrencyId: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createReceivableAction(_prev, formData);
    if (result.success) setOpen(false);
    return result;
  }, initialState);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b]"><Plus size={15} /> Add Receivable</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onMouseDown={() => setOpen(false)}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-white/10 bg-[#0d151e] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] md:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400"><CircleDollarSign size={21} /></div><div><h2 className="text-lg font-semibold text-white">Add Receivable</h2><p className="mt-1 text-xs leading-5 text-slate-500">Record money owed to you from a loan, shared expense, or someone using your wallet or credit card.</p></div></div>
        <form action={formAction} className="mt-5 overflow-hidden rounded-[20px] border border-white/10 bg-[#0a1119]"><div className="space-y-6 p-5 md:p-6"><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="text-sm font-medium text-slate-200">Person name <span className="text-emerald-400">*</span></span><input name="personName" required placeholder="e.g. Andi" className={`mt-2 w-full ${inputClass}`} /></label><label className="block"><span className="text-sm font-medium text-slate-200">What is this for? <span className="text-emerald-400">*</span></span><input name="description" required placeholder="e.g. Dinner, Loan, Reimbursement" className={`mt-2 w-full ${inputClass}`} /></label></div><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="text-sm font-medium text-slate-200">Amount <span className="text-emerald-400">*</span></span><div className="mt-2 flex overflow-hidden rounded-xl border border-white/10 bg-[#070c12]"><select name="currencyId" required defaultValue={defaultCurrencyId} className="w-[112px] shrink-0 border-r border-white/10 bg-transparent px-3 py-3 text-sm text-slate-300 outline-none">{currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code} · {currency.symbol}</option>)}</select><input name="amount" required inputMode="decimal" placeholder="0" className="min-w-0 w-full bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600" /></div></label><label className="block"><span className="text-sm font-medium text-slate-200">From wallet <span className="text-emerald-400">*</span></span><select name="sourceWalletId" required className={`mt-2 w-full ${selectClass}`}><option value="">Select wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}{wallet.walletType === "CREDIT_CARD" ? " · CC" : ""}</option>)}</select></label></div><div className="grid gap-4 md:grid-cols-2"><label className="block"><div className="flex items-center gap-1.5"><span className="text-sm font-medium text-slate-200">Loan Date <span className="text-emerald-400">*</span></span><span title="When did you give the money?" className="text-slate-600"><Info size={14} /></span></div><p className="mt-1 text-[10px] text-slate-600">When did you give the money?</p><input name="loanDate" type="date" required defaultValue={today} className={`mt-2 w-full ${inputClass}`} /></label><label className="block"><div className="flex items-center gap-1.5"><span className="text-sm font-medium text-slate-200">Expected Payment Date</span><span title="When do you expect to receive it back?" className="text-slate-600"><Info size={14} /></span></label><p className="mt-1 text-[10px] text-slate-600">When do you expect to receive it back? (optional)</p><input name="dueDate" type="date" className={`mt-2 w-full ${inputClass}`} /></label></div></div><div className="flex justify-end gap-2 border-t border-white/5 bg-[#0d151e] p-4"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300">Cancel</button><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#07110b]">{pending ? "Saving..." : <><CircleDollarSign size={16} /> Save Receivable</>}</button></div></form>{state.message && <p className="mt-3 text-xs text-red-300">{state.message}</p>}</div>
    </div>}
  </>;
}
