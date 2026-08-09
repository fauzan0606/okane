"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CreditCardStatement } from "@prisma/client";
import { updateStatementAction } from "../actions";

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

function statusLabel(status: CreditCardStatement["status"]) {
  if (status === "PAID") return "PAID";
  if (status === "PARTIALLY_PAID") return "PARTIALLY PAID";
  if (status === "OVERDUE") return "OVERDUE";
  return "UNPAID";
}

export default function CreditCardStatementCard({ statement }: { statement: CreditCardStatement }) {
  const [pending, setPending] = useState(false);
  const calculatedAmount = Number(statement.calculatedAmount);
  const actualAmount = statement.actualAmount === null ? null : Number(statement.actualAmount);
  const paidAmount = Number(statement.paidAmount);
  const targetAmount = actualAmount ?? calculatedAmount;
  const remainingAmount = Math.max(targetAmount - paidAmount, 0);
  const difference = actualAmount === null ? null : actualAmount - calculatedAmount;
  const statusClass = statement.status === "PAID"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
    : statement.status === "OVERDUE"
      ? "border-red-400/25 bg-red-400/10 text-red-300"
      : statement.status === "PARTIALLY_PAID"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
        : "border-white/10 bg-white/5 text-slate-300";

  async function submit(formData: FormData) {
    setPending(true);
    try {
      await updateStatementAction(formData);
      toast.success("Statement updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update statement.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`rounded-[20px] border bg-[#0E151E] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.16)] ${statement.status === "OVERDUE" ? "border-red-400/25" : "border-white/10"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            Statement {new Date(statement.statementDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Period {new Date(statement.periodStart).toLocaleDateString("id-ID")} – {new Date(statement.periodEnd).toLocaleDateString("id-ID")}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
          {statusLabel(statement.status)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Calculated</p>
          <p className="mt-1 text-lg font-semibold text-white">Rp{formatMoney(calculatedAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Bank Statement</p>
          <p className="mt-1 text-lg font-semibold text-white">{actualAmount === null ? "—" : `Rp${formatMoney(actualAmount)}`}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Paid</p>
          <p className="mt-1 text-lg font-semibold text-white">Rp{formatMoney(paidAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Remaining</p>
          <p className={`mt-1 text-lg font-semibold ${remainingAmount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
            Rp{formatMoney(remainingAmount)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
        <span>Statement date: {new Date(statement.statementDate).toLocaleDateString("id-ID")}</span>
        <span>Due: {new Date(statement.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
        {statement.paidAt && <span>Paid on: {new Date(statement.paidAt).toLocaleDateString("id-ID")}</span>}
      </div>

      <form action={submit} className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-3">
        <input type="hidden" name="id" value={statement.id} />
        <label className="text-xs text-slate-500">
          Actual Amount
          <input name="actualAmount" defaultValue={statement.actualAmount?.toString() ?? statement.calculatedAmount.toString()} inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none" />
        </label>
        <label className="text-xs text-slate-500">
          Paid Amount
          <input name="paidAmount" defaultValue={statement.paidAmount.toString()} inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none" />
        </label>
        <label className="text-xs text-slate-500">
          Paid Date
          <input name="paidAt" type="date" defaultValue={statement.paidAt ? new Date(statement.paidAt).toISOString().slice(0, 10) : ""} className="mt-1 w-full rounded-xl border border-white/10 bg-[#070C12] px-3 py-2 text-sm text-white outline-none" />
        </label>
        <div className="md:col-span-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Payment date is required when Paid Amount is greater than zero.</p>
          <button type="submit" disabled={pending} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#06110b] transition hover:bg-emerald-400 disabled:opacity-50">
            {pending ? "Saving…" : "Save Statement"}
          </button>
        </div>
      </form>

      {difference !== null && (
        <p className={`mt-3 text-xs ${Math.abs(difference) < 0.5 ? "text-emerald-300" : "text-amber-300"}`}>
          Difference between OKANE calculation and bank statement: Rp{formatMoney(difference)}
        </p>
      )}

      {statement.status !== "PAID" && new Date() > statement.dueDate && (
        <p className="mt-2 text-sm font-medium text-red-300">⚠ This statement is overdue. Please record the payment when it is made.</p>
      )}
      {paidAmount > targetAmount && (
        <p className="mt-2 text-xs text-slate-500">Payment exceeds the current statement amount.</p>
      )}
    </div>
  );
}
