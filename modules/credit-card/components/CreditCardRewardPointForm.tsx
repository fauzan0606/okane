"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateCreditCardRewardPointAction } from "../actions";

export default function CreditCardRewardPointForm({ walletId, rewardPoint }: { walletId: string; rewardPoint: string }) {
  const [value, setValue] = useState(rewardPoint);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    try {
      await updateCreditCardRewardPointAction(formData);
      toast.success("Reward points updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update reward points.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <input type="hidden" name="walletId" value={walletId} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Reward Points</p>
          <p className="mt-0.5 text-xs text-slate-500">Enter your current balance manually. OKANE does not calculate points.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input name="rewardPoint" value={value} onChange={(event) => setValue(event.target.value)} type="number" min="0" step="any" inputMode="decimal" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none sm:w-40 sm:flex-none" aria-label="Reward points" />
          <button type="submit" disabled={pending || value === ""} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#06110b] transition hover:bg-emerald-400 disabled:opacity-50">{pending ? "Saving…" : "Save Points"}</button>
        </div>
      </div>
    </form>
  );
}
