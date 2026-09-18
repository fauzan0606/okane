"use client";

import { useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SplitBillForm from "./SplitBillForm";

type Props = { currencySymbol?: string };

export default function NewSplitBillPanel({ currencySymbol = "Rp" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:bg-emerald-400"
      >
        <Plus size={15} />
        Split Bill
      </button>
      <DialogContent
        showCloseButton
        className="!left-0 !top-0 !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 min-w-0 max-h-[100dvh] overflow-x-hidden overflow-y-auto rounded-none border border-[#30465D] bg-[#0E1925] p-0 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:!left-1/2 sm:!top-1/2 sm:!h-auto sm:!w-[calc(100vw-3rem)] sm:!max-w-[1100px] sm:!translate-x-1/2 sm:!translate-y-1/2 sm:max-h-[94vh] sm:rounded-[24px] sm:pb-0"
      >
        <div className="min-w-0 w-full p-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6 md:p-8 md:pt-8">
          <DialogHeader className="mb-5 min-w-0 flex-row items-start gap-3 pr-10 sm:mb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 sm:h-11 sm:w-11">
              <ReceiptText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-semibold text-white">New Split Bill</DialogTitle>
              <DialogDescription className="mt-1 break-words text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">Start with the merchant. No transaction or wallet is required at this stage.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="min-w-0 w-full">
            <SplitBillForm currencySymbol={currencySymbol} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
