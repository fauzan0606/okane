"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowRight, X } from "lucide-react";
import { createTransferAction } from "../actions";

type WalletOption = { id: string; name: string; walletType: string; currentBalance: number; currency: { code: string; symbol: string } };

function todayInput() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatMoney(value: number, symbol: string) { return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`; }
const inputClass = "w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40";
const selectClass = "w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-emerald-400/40";

export default function TransferForm({ wallets }: { wallets: WalletOption[] }) {
  const [open, setOpen] = useState(false);

  return <div className="w-full">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Move money between accounts</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Transfer</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">Move money between your own wallets without creating income or expense transactions.</p>
      </div>
      {!open && <button type="button" onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#06110b] transition hover:bg-emerald-400 sm:self-auto"><ArrowLeftRight size={15} /> + Transfer</button>}
    </div>

    {open && <section className="mt-5 rounded-[22px] border border-white/10 bg-[#0d151e] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.16)] md:p-6">
      <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><ArrowLeftRight size={18} /></div><div><h2 className="text-base font-semibold text-white">New Transfer</h2><p className="mt-1 text-xs text-slate-500">Move money between your wallets without creating an income or expense transaction.</p></div></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Close transfer form"><X size={17} /></button></div>
      {wallets.length < 2 ? <div className="mt-5 rounded-xl border border-dashed border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm text-amber-200">You need at least two active wallets before creating a transfer.</div> : <form action={async (formData) => { await createTransferAction(formData); setOpen(false); }} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-xs text-slate-500">From wallet<select name="fromWalletId" required className={`mt-1.5 ${selectClass}`} defaultValue=""><option value="" disabled>Select source wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code} · {formatMoney(wallet.currentBalance, wallet.currency.symbol)}</option>)}</select></label>
        <label className="text-xs text-slate-500">To wallet<select name="toWalletId" required className={`mt-1.5 ${selectClass}`} defaultValue=""><option value="" disabled>Select destination wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}</select></label>
        <label className="text-xs text-slate-500">Amount<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0" className={`mt-1.5 ${inputClass}`} /></label>
        <label className="text-xs text-slate-500">Transfer fee <span className="text-slate-600">(optional)</span><input name="feeAmount" type="number" min="0" step="0.01" placeholder="0" className={`mt-1.5 ${inputClass}`} /></label>
        <input type="hidden" name="transferDate" value={todayInput()} />
        <div className="flex items-end justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"><X size={15} />Cancel</button><button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#06110b] hover:bg-emerald-400"><ArrowRight size={16} />Transfer</button></div>
      </form>}
    </section>}
  </div>;
}
