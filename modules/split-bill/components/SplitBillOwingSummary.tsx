"use client";

import { useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";

type OwingEntry = {
  personName: string;
  merchantName: string;
  transactionDate: string | null;
  amount: number;
  received: number;
  remaining: number;
  symbol: string;
};

type Props = {
  peopleOwing: number;
  totalToReceive: number;
  entries: OwingEntry[];
  symbol: string;
};

function money(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function date(value: string | null) {
  if (!value) return "Not finalized";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function SplitBillOwingSummary({ peopleOwing, totalToReceive, entries, symbol }: Props) {
  const [open, setOpen] = useState<"people" | "receive" | null>(null);
  const list = entries.filter((entry) => entry.remaining > 0);

  return <>
    <button type="button" onClick={() => setOpen("people")} className="w-full rounded-[18px] border border-[#30465D] bg-[#172A3D] px-4 py-4 text-left shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition hover:border-[#45627E] hover:bg-[#1C3147]">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">People Owing</p>
      <p className="mt-1 text-xl font-semibold text-white">{peopleOwing}</p>
      <p className="mt-1 text-[10px] text-slate-500">Click to view who owes you</p>
    </button>
    <button type="button" onClick={() => setOpen("receive")} className="w-full rounded-[18px] border border-emerald-400/10 bg-[#172A3D] px-4 py-4 text-left shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition hover:border-emerald-400/25 hover:bg-[#1C3147]">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">To Receive</p>
      <p className="mt-1 text-xl font-semibold text-emerald-300">{money(totalToReceive, symbol)}</p>
      <p className="mt-1 text-[10px] text-slate-500">Click to view receivables</p>
    </button>

    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onMouseDown={() => setOpen(null)}>
      <div className="w-full max-w-2xl rounded-[24px] border border-[#30465D] bg-[#0E1925] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Split Bill</p><h2 className="mt-1 text-xl font-semibold text-white">{open === "people" ? "People Owing" : "To Receive"}</h2><p className="mt-1 text-xs text-slate-500">Outstanding amounts grouped by person and Split Bill.</p></div>
          <button type="button" onClick={() => setOpen(null)} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 hover:text-white" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="mt-5 max-h-[60vh] space-y-2 overflow-y-auto">
          {list.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-[#0B141F] p-8 text-center"><ArrowDownToLine size={22} className="mx-auto text-slate-600" /><p className="mt-2 text-sm font-semibold text-white">Nothing outstanding</p><p className="mt-1 text-xs text-slate-500">Everyone is settled.</p></div> : list.map((entry, index) => <div key={`${entry.merchantName}-${entry.personName}-${entry.transactionDate}-${index}`} className="rounded-2xl border border-white/5 bg-[#172A3D] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold text-white">{entry.personName}</p><p className="mt-1 text-xs text-slate-400">{entry.merchantName} · {date(entry.transactionDate)}</p></div><div className="text-left sm:text-right"><p className="text-sm font-bold text-emerald-300">{money(entry.remaining, entry.symbol)}</p><p className="mt-1 text-[10px] text-slate-500">Share {money(entry.amount, entry.symbol)} · Received {money(entry.received, entry.symbol)}</p></div></div></div>)}
        </div>
      </div>
    </div>}
  </>;
}
