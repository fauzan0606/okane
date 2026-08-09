"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CreditCard } from "lucide-react";
import CreditCardStatementCard from "./CreditCardStatementCard";
import type { CreditCardStatementView } from "./CreditCardStatementCard";

type ForecastData = { amount: number; periodStart: string; statementDate: string; dueDate: string } | null;

type CreditCardAccountCardProps = {
  wallet: { id: string; name: string; currencySymbol: string; creditLimit: string; billingDate: number; dueDay: number };
  statements: CreditCardStatementView[];
  forecast: ForecastData;
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
  return { label: "UNPAID", className: "border-white/10 bg-white/5 text-slate-300" };
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

export default function CreditCardAccountCard({ wallet, statements, forecast, defaultExpanded = false }: CreditCardAccountCardProps) {
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
    <section className="overflow-hidden rounded-[20px] border border-white/10 bg-[#0E151E] shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full px-5 py-5 text-left transition hover:bg-white/[0.02] md:px-6" aria-expanded={expanded}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><CreditCard size={18} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-white">{wallet.name}</h2><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${meta.className}`}>{meta.label}</span></div>
            <p className="mt-1 text-xs text-slate-500">Limit {wallet.currencySymbol}{formatMoney(Number(wallet.creditLimit))} · Billing day {wallet.billingDate}</p>
          </div>
          <ChevronDown size={19} className={`mt-1 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div><p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Outstanding</p><p className={`mt-1 text-2xl font-bold tracking-tight ${status === "OVERDUE" ? "text-red-300" : "text-white"}`}>{wallet.currencySymbol}{formatMoney(outstanding)}</p></div>
          <div className="sm:text-center"><p className="text-[10px] text-slate-500">{status === "OVERDUE" ? "Payment status" : "Payment timing"}</p><p className={`mt-1 text-sm font-semibold ${status === "OVERDUE" ? "text-red-300" : status === "PARTIALLY_PAID" ? "text-amber-300" : "text-slate-200"}`}>{dueLabel(dueDate, status)}</p>{dueDate && <p className="mt-0.5 text-[10px] text-slate-600">{formatDate(dueDate)}</p>}</div>
          <div className="sm:text-right"><p className="text-[10px] text-slate-500">Next Statement</p><p className="mt-1 text-sm font-semibold text-slate-200">{wallet.currencySymbol}{formatMoney(forecast?.amount ?? 0)}</p></div>
        </div>

        <div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${utilization >= 80 ? "bg-red-400" : utilization >= 50 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${utilization}%` }} /></div><span className="text-[10px] font-semibold text-slate-500">{utilization.toFixed(1)}%</span></div>
      </button>

      {expanded && <div className="border-t border-white/5 px-5 pb-5 pt-5 md:px-6 md:pb-6"><div className="mb-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Statement history</p><p className="mt-1 text-sm text-slate-400">Edit the latest statement or review previous billing cycles.</p></div><div className="space-y-4">{statements.map((statement) => <CreditCardStatementCard key={statement.id} statement={statement} />)}</div></div>}
    </section>
  );
}
