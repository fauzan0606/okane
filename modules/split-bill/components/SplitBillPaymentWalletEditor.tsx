"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateSplitBillPaymentWalletAction } from "../actions";

type WalletOption = { id: string; name: string };

type Props = {
  splitBillId: string;
  currentWalletId: string;
  paymentId?: string;
  wallets: WalletOption[];
};

const selectClass = "rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50";

export default function SplitBillPaymentWalletEditor({ splitBillId, currentWalletId, paymentId, wallets }: Props) {
  const [editing, setEditing] = useState(false);
  const [walletId, setWalletId] = useState(currentWalletId);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  useEffect(() => setWalletId(currentWalletId), [currentWalletId]);

  function save() {
    if (!walletId || walletId === currentWalletId || isSaving) return;
    const formData = new FormData();
    formData.set("splitBillId", splitBillId);
    formData.set("walletId", walletId);
    if (paymentId) formData.set("paymentId", paymentId);
    startSaving(async () => {
      const result = await updateSplitBillPaymentWalletAction(formData);
      if (!result.success) {
        toast.error(result.message ?? "Unable to update the payment wallet.");
        return;
      }
      toast.success("Payment wallet updated.");
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:border-emerald-400/30 hover:text-emerald-300">
        <Pencil size={11} /> Change payment wallet
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select aria-label="Payment wallet" value={walletId} onChange={(event) => setWalletId(event.target.value)} disabled={isSaving} className={selectClass}>
        {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
      </select>
      <button type="button" onClick={save} disabled={isSaving || !walletId || walletId === currentWalletId} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40">
        {isSaving ? <LoaderCircle size={11} className="animate-spin" /> : <Check size={11} />} {isSaving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => { setWalletId(currentWalletId); setEditing(false); }} disabled={isSaving} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 disabled:opacity-50">
        <X size={11} /> Cancel
      </button>
    </div>
  );
}
