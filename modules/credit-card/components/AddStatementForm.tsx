"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createManualStatementAction } from "../actions";

export default function AddStatementForm({ walletId }: { walletId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    try { await createManualStatementAction(formData); toast.success("Statement added."); setOpen(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to add statement."); }
    finally { setPending(false); }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/15"><Plus size={14} /> Add Statement</button>;

  return <form action={submit} className="rounded-[18px] border border-white/10 bg-[#0d141e] p-4">
    <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Add bank statement</p><p className="mt-1 text-xs text-slate-500">Useful when you use OKANE only as a credit-card bill reminder.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:text-white"><X size={17} /></button></div>
    <input type="hidden" name="walletId" value={walletId} />
    <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <label className="text-xs text-slate-500">Period start<input name="periodStart" type="date" required className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white" /></label>
      <label className="text-xs text-slate-500">Period end<input name="periodEnd" type="date" required className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white" /></label>
      <label className="text-xs text-slate-500">Statement date<input name="statementDate" type="date" required className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white" /></label>
      <label className="text-xs text-slate-500">Due date<input name="dueDate" type="date" required className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white" /></label>
      <label className="text-xs text-slate-500">Bank statement amount<input name="actualAmount" inputMode="decimal" required placeholder="0" className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white" /></label>
    </div>
    <div className="mt-3 flex justify-end"><button type="submit" disabled={pending} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#06110b] hover:bg-emerald-400 disabled:opacity-50">{pending ? "Saving…" : "Save Statement"}</button></div>
  </form>;
}
