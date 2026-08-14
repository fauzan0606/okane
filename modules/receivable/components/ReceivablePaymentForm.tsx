"use client";

import { useActionState } from "react";
import { ArrowDownLeft } from "lucide-react";
import { recordReceivablePaymentAction } from "../actions";

type Wallet = { id: string; name: string; walletType: string; currency: { code: string } };
type State = { success: boolean; message?: string };

const inputClass = "rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600";
const selectClass = "rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none";

export default function ReceivablePaymentForm({ receivableId, remaining, today, wallets }: { receivableId: string; remaining: number; today: string; wallets: Wallet[] }) {
  const [state, formAction, pending] = useActionState(async (_prev: State, formData: FormData): Promise<State> => recordReceivablePaymentAction(formData), { success: false });

  return (
    <form action={formAction} className="grid gap-2 md:grid-cols-[1fr_1fr_1.2fr_auto]">
      <input type="hidden" name="receivableId" value={receivableId} />
      <input name="amount" required inputMode="decimal" min="0" placeholder="Amount received" className={inputClass} />
      <input name="receivedAt" type="date" required defaultValue={today} className={inputClass} />
      <select name="walletId" required className={selectClass}><option value="">Money received into...</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}</select>
      <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><ArrowDownLeft size={14} /> {pending ? "Recording..." : "Record"}</button>
      {state.message && <p className="md:col-span-4 text-xs text-red-300">{state.message}</p>}
    </form>
  );
}
