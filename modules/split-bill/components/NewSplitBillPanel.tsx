"use client";

import { useState } from "react";
import { Plus, ReceiptText, X } from "lucide-react";
import SplitBillForm from "./SplitBillForm";

type Props = { currencySymbol?: string };

export default function NewSplitBillPanel({ currencySymbol = "Rp" }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:bg-emerald-400"
        >
          <Plus size={15} />
          Split Bill
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-[24px] border border-[#30465D] bg-[#0E1925] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] md:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
            <ReceiptText size={21} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">New Split Bill</h2>
            <p className="mt-1 text-xs text-slate-500">Start with the merchant. No transaction or wallet is required at this stage.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-slate-400 hover:border-white/20 hover:text-white"
          title="Close new Split Bill"
        >
          <X size={15} />
        </button>
      </div>
      <SplitBillForm currencySymbol={currencySymbol} />
    </section>
  );
}
