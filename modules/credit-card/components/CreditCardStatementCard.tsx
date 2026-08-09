"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CreditCardStatementStatus } from "@prisma/client";
import { recordStatementPaymentAction, updateStatementAction } from "../actions";

export type CreditCardStatementPaymentView = { id: string; amount: string; paidAt: string; note: string | null };
export type CreditCardStatementView = {
  id: string;
  creditCardId: string;
  periodStart: string;
  periodEnd: string;
  statementDate: string;
  dueDate: string;
  calculatedAmount: string;
  actualAmount: string | null;
  paidAmount: string;
  paidAt: string | null;
  status: CreditCardStatementStatus;
  createdAt: string;
  updatedAt: string;
  payments: CreditCardStatementPaymentView[];
};

function formatMoney(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }
function statusLabel(status: CreditCardStatementStatus) { if (status === "PAID") return "PAID"; if (status === "PARTIALLY_PAID") return "PARTIALLY PAID"; if (status === "OVERDUE") return "OVERDUE"; return "UNPAID"; }

export default function CreditCardStatementCard({ statement }: { statement: CreditCardStatementView }) {
  const [pending, setPending] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const calculatedAmount = Number(statement.calculatedAmount);
  const actualAmount = statement.actualAmount === null ? null : Number(statement.actualAmount);
  const paidAmount = Number(statement.paidAmount);
  const targetAmount = actualAmount ?? calculatedAmount;
  const remainingAmount = Math.max(targetAmount - paidAmount, 0);
  const difference = actualAmount === null ? null : actualAmount - calculatedAmount;
  const statusClass = statement.status === "PAID" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : statement.status === "OVERDUE" ? "border-red-400/25 bg-red-400/10 text-red-300" : statement.status === "PARTIALLY_PAID" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : "border-red-400/20 bg-red-400/10 text-red-300";

  async function submit(formData: FormData) {
    setPending(true);
    try { await updateStatementAction(formData); toast.success("Statement updated."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update statement."); }
    finally { setPending(false); }
  }

  async function submitPayment(formData: FormData) {
    setPaymentPending(true);
    try { await recordStatementPaymentAction(formData); setPaymentAmount(""); toast.success("Payment recorded."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to record payment."); }
    finally { setPaymentPending(false); }
  }

  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0E151E] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-white">{new Date(statement.statementDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</p><p className="mt-1 text-xs text-slate-500">Period {new Date(statement.periodStart).toLocaleDateString("id-ID")} – {new Date(statement.periodEnd).toLocaleDateString("id-ID")}</p></div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel(statement.status)}</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div><p className="text-xs text-slate-500">Calculated</p><p className="mt-1 text-lg font-semibold text-white">Rp{formatMoney(calculatedAmount)}</p></div>
        <div><p className="text-xs text-slate-500">Bank Statement</p><p className="mt-1 text-lg font-semibold text-white">{actualAmount === null ? "—" : `Rp${formatMoney(actualAmount)}`}</p></div>
        <div><p className="text-xs text-slate-500">Paid</p><p className="mt-1 text-lg font-semibold text-white">Rp{formatMoney(paidAmount)}</p></div>
        <div><p className="text-xs text-slate-500">Remaining</p><p className={`mt-1 text-lg font-semibold ${remainingAmount > 0 ? "text-amber-300" : "text-emerald-300"}`}>Rp{formatMoney(remainingAmount)}</p></div>
      </div>
      <form action={submit} className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto]">
        <input type="hidden" name="id" value={statement.id} />
        <label className="text-xs text-slate-500">Bank Statement Amount<input name="actualAmount" defaultValue={statement.actualAmount ?? statement.calculatedAmount} inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none" /></label>
        <div className="flex items-end"><button type="submit" disabled={pending} className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#06110b] transition hover:bg-emerald-400 disabled:opacity-50 md:w-auto">{pending ? "Saving…" : "Save Statement"}</button></div>
      </form>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">Payment History</p><p className="mt-0.5 text-xs text-slate-500">Record every payment here. Paid and Remaining update automatically.</p></div><p className="text-sm font-semibold text-slate-200">Rp{formatMoney(paidAmount)}</p></div>
        {statement.payments.length > 0 && <div className="mt-3 space-y-2">{statement.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between rounded-xl bg-[#070C12] px-3 py-2 text-xs"><span className="text-slate-400">{new Date(payment.paidAt).toLocaleDateString("id-ID")}{payment.note ? ` · ${payment.note}` : ""}</span><span className="font-semibold text-emerald-300">Rp{formatMoney(Number(payment.amount))}</span></div>)}</div>}
        {statement.status !== "PAID" && <form action={submitPayment} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1.5fr_auto_auto]">
          <input type="hidden" name="statementId" value={statement.id} />
          <input name="amount" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Payment amount" inputMode="decimal" className="rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none" />
          <input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none" />
          <input name="note" placeholder="Note (optional)" className="rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none" />
          <button type="button" onClick={() => setPaymentAmount(String(remainingAmount))} disabled={remainingAmount <= 0} className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-40">Pay Remaining</button>
          <button type="submit" disabled={paymentPending || !paymentAmount} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#06110b] hover:bg-emerald-400 disabled:opacity-50">{paymentPending ? "Saving…" : "Add Payment"}</button>
        </form>}
      </div>
      {difference !== null && <p className={`mt-3 text-xs ${Math.abs(difference) < 0.5 ? "text-emerald-300" : "text-amber-300"}`}>Difference: Rp{formatMoney(difference)}</p>}
      {statement.paidAt && <p className="mt-2 text-xs text-slate-500">Last payment recorded on {new Date(statement.paidAt).toLocaleDateString("id-ID")}</p>}
      {statement.status !== "PAID" && new Date() > new Date(statement.dueDate) && <p className="mt-2 text-sm font-medium text-red-300">⚠ This statement is overdue.</p>}
    </div>
  );
}
