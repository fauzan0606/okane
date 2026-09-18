"use client";

import { useEffect, useState } from "react";
import { Plus, ReceiptText, X } from "lucide-react";
import SplitBillForm from "./SplitBillForm";

type Props = { currencySymbol?: string };

export default function NewSplitBillPanel({ currencySymbol = "Rp" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:bg-emerald-400"
      >
        <Plus size={15} />
        Split Bill
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-stretch justify-center sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close Split Bill"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-split-bill-title"
            className="relative z-10 flex h-full w-full min-w-0 max-w-[1100px] flex-col overflow-hidden border border-[#30465D] bg-[#0E1925] text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:max-h-[94vh] sm:rounded-[24px]"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
              <div className="min-w-0 w-full p-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6 md:p-8 md:pt-8">
                <div className="mb-5 flex min-w-0 items-start gap-3 pr-10 sm:mb-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 sm:h-11 sm:w-11">
                    <ReceiptText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 id="new-split-bill-title" className="text-xl font-semibold text-white">New Split Bill</h2>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">Start with the merchant. No transaction or wallet is required at this stage.</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close Split Bill"
                    onClick={() => setOpen(false)}
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#172A3D] text-slate-300 transition hover:text-white sm:right-4 sm:top-4"
                  >
                    <X size={18} />
                  </button>
                </div>
                <SplitBillForm currencySymbol={currencySymbol} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
