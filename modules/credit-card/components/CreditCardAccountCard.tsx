"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CreditCard, ReceiptText } from "lucide-react";
import CreditCardStatementCard from "./CreditCardStatementCard";
import type { CreditCardStatementView } from "./CreditCardStatementCard";
import AddStatementForm from "./AddStatementForm";
import CreditCardRewardPointForm from "./CreditCardRewardPointForm";

type ForecastData = { amount: number; periodStart: string; statementDate: string; dueDate: string } | null;
type InstallmentView = {
  id: string;
  transactionId: string;
  merchant: string;
  category: string;
  totalAmount: string;
  feeAmount: string;
  installmentAmount: string;
  tenorMonths: number;
  startDate: string;
  currentInstallment: number;
  remainingInstallments: number;
};
type CreditCardAccountCardProps = {
  wallet: { id: string; name: string; currencySymbol: string; creditLimit: string; rewardPoint: string; billingDate: number; dueDay: number };
  statements: CreditCardStatementView[];
  forecast: ForecastData;
  installments: InstallmentView[];
  defaultExpanded?: boolean;
};

function formatMoney(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat("id-ID", options ?? { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime(); }
function daysUntil(value: string | Date) { return Math.round((startOfDay(new Date(value)) - startOfDay(new Date())) / 86400000); }

function statusMeta(status: CreditCardStatementView["status"]) {
  if (status === "PAID") return { label: "PAID", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" };
  if (status === "OVERDUE") return { label: "OVERDUE", className: "border-red-400/25 bg-red-400/10 text-red-300" };
  if (status === "PARTIALLY_PAID") return { label: "PARTIALLY PAID", className: "border-amber-400/20 bg-amber-400/10 text-amber-300" };
  return { label: "UNPAID", className: "border-red-400/20 bg-red-400/10 text-red-300" };
}

function dueLabel(dueDate: string | null, status: CreditCardStatementView["status"]) {
  if (!dueDate) return "Due date not available";
  const days = daysUntil(dueDate);
  if (status !== "PAID" && days < 0) return `Overdue ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1 && days <= 14) return `Due in ${days} days`;
  return `Due ${formatDate(dueDate, { day: "2-digit", month: "short" })}`;
}

export default function CreditCardAccountCard({ wallet, statements, forecast, installments, defaultExpanded = false }: CreditCardAccountCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const currentStatement = useMemo(() => statements.find((statement) => statement.status !== "PAID") ?? statements[0] ?? null, [statements]);
  const targetAmount = currentStatement ? Number(currentStatement.actualAmount ?? currentStatement.calculatedAmount) : 0;
  const paidAmount = currentStatement ? Number(currentStatement.paidAmount) : 0;
  const remaining = Math.max(targetAmount - paidAmount, 0);
  const status = currentStatement?.status ?? "UNPAID";
  const meta = statusMeta(status);
  const dueDate = currentStatement ? currentStatement.dueDate : forecast?.dueDate ?? null;
  const outstanding = status === "PAID" ? 0 : remaining;
  const utilization = Number(wallet.creditLimit) > 0 ? Math.min((outstanding / Number(wallet.creditLimit)) * 100, 100) : 0;

  return (
    <section className="overflow-hidden rounded-[20px] border border-white/10 bg-[#101923] shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full px-5 py-5 text-left transition hover:bg-white/[0.025] md:px-6" aria-expanded={expanded}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><CreditCard size={18} /></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-white">{wallet.name}</h2><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${meta.className}`}>{meta.label}</span></div><p className="mt-1 text-xs text-slate-500">Limit {wallet.currencySymbol}{formatMoney(Number(wallet.creditLimit))} · Billing day {wallet.billingDate}</p></div>
          <div className="flex shrink-0 items-start gap-3">
            <div className="hidden text-right sm:block"><p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Points</p><p className="mt-0.5 text-xs font-semibold text-slate-300">{formatMoney(Number(wallet.rewardPoint))} pts</p></div>
            <div className="hidden text-right sm:block"><p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Installments</p><p className={`mt-0.5 text-xs font-semibold ${installments.length > 0 ? "text-emerald-300" : "text-slate-500"}`}>{installments.length} active</p></div>
            <ChevronDown size={19} className={`mt-1 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div><p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Outstanding</p><p className={`mt-1 text-2xl font-bold tracking-tight ${status === "OVERDUE" || status === "UNPAID" ? "text-red-300" : "text-white"}`}>{wallet.currencySymbol}{formatMoney(outstanding)}</p></div>
          <div className="sm:text-center"><p className="text-[10px] text-slate-500">Payment timing</p><p className={`mt-1 text-sm font-semibold ${status === "OVERDUE" || status === "UNPAID" ? "text-red-300" : status === "PARTIALLY_PAID" ? "text-amber-300" : "text-slate-200"}`}>{status === "PAID" ? "Paid" : dueLabel(dueDate, status)}</p>{dueDate && <p className="mt-0.5 text-[10px] text-slate-600">{formatDate(dueDate)}</p>}</div>
          <div className="sm:text-right"><p className="text-[10px] text-slate-500">Next Statement</p><p className="mt-1 text-sm font-semibold text-slate-200">{wallet.currencySymbol}{formatMoney(forecast?.amount ?? 0)}</p></div>
        </div>
        <div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${utilization >= 80 ? "bg-red-400" : utilization >= 50 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${utilization}%` }} /></div><span className="text-[10px] font-semibold text-slate-500">{utilization.toFixed(1)}%</span></div>
      </button>

      {expanded && <div className="border-t border-white/10 bg-[#0b131c] px-5 pb-5 pt-5 md:px-6 md:pb-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Card details</p><p className="mt-1 text-sm text-slate-400">Keep your reward balance, statements, payments, and installments up to date.</p></div><AddStatementForm walletId={wallet.id} /></div>
        <div className="mb-5"><CreditCardRewardPointForm walletId={wallet.id} rewardPoint={wallet.rewardPoint} /></div>
        <div className="space-y-4">{statements.map((statement) => <CreditCardStatementCard key={statement.id} statement={statement} />)}</div>

        {installments.length > 0 && <div className="mt-6 rounded-2xl border border-white/10 bg-[#101923] p-4 md:p-5">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Active installments</p><h3 className="mt-1 text-base font-semibold text-white">Installment plans</h3><p className="mt-1 text-xs text-slate-500">Scheduled installment progress for this card.</p></div><span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-300">{installments.length} active</span></div>
          <div className="mt-4 divide-y divide-white/5">{installments.map((installment) => { const progress = installment.tenorMonths > 0 ? Math.min((installment.currentInstallment / installment.tenorMonths) * 100, 100) : 0; return <div key={installment.id} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><ReceiptText size={15} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{installment.merchant}</p><p className="mt-0.5 truncate text-xs text-slate-500">{installment.category} · Started {formatDate(installment.startDate, { day: "2-digit", month: "short", year: "numeric" })}</p></div></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-slate-200">{wallet.currencySymbol}{formatMoney(Number(installment.installmentAmount))}</p><p className="mt-0.5 text-[10px] text-slate-500">per month</p></div></div><div className="mt-3 flex items-center justify-between gap-3 text-[11px]"><span className="font-semibold text-slate-200">Installment {installment.currentInstallment} / {installment.tenorMonths}</span><span className="text-slate-500">{installment.remainingInstallments} remaining</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-600"><span>Total {wallet.currencySymbol}{formatMoney(Number(installment.totalAmount))}</span><span>{installment.feeAmount !== "0" ? `Fee ${wallet.currencySymbol}${formatMoney(Number(installment.feeAmount))}` : "0% / no fee"}</span></div></div>; })}</div>
        </div>}
      </div>}
    </section>
  );
}
