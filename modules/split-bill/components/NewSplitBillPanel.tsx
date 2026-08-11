"use client";

import { useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SplitBillForm from "./SplitBillForm";

type Props = { currencySymbol?: string };

export default function NewSplitBillPanel({ currencySymbol = "Rp" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:bg-emerald-400"
          />
        }
      >
        <Plus size={15} />
        Split Bill
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="!w-[calc(100vw-1.5rem)] !max-w-[1100px] max-h-[94vh] overflow-y-auto rounded-[24px] border border-[#30465D] bg-[#0E1925] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:!w-[calc(100vw-3rem)]"
      >
        <div className="p-4 sm:p-6 md:p-8">
          <DialogHeader className="mb-5 flex-row items-start gap-3 pr-10 sm:mb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 sm:h-11 sm:w-11">
              <ReceiptText size={20} />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-white">New Split Bill</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">Start with the merchant. No transaction or wallet is required at this stage.</DialogDescription>
            </div>
          </DialogHeader>
          <SplitBillForm currencySymbol={currencySymbol} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
