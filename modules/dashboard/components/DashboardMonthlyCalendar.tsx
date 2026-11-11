"use client";

import { useState } from "react";
import { CalendarDays, List } from "lucide-react";
import type { DashboardCalendar } from "../types";

const weekdays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const dailyDateFormatter = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function formatCompactCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function DashboardMonthlyCalendar({
  calendar,
  currencyCode,
}: {
  calendar: DashboardCalendar;
  currencyCode: string;
}) {
  const [view, setView] = useState<"calendar" | "daily">("calendar");
  const calendarCells = [...Array(calendar.firstWeekday).fill(null), ...calendar.days];
  const weekCount = Math.ceil(calendarCells.length / 7);
  const contentHeight = 24 + weekCount * 68;
  const [year, month] = calendar.month.split("-").map(Number);

  return (
    <section className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Monthly calendar</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{calendar.label}</h2>
        </div>
        <div className="flex shrink-0 rounded-xl border border-white/10 bg-[#0a1119] p-1" role="group" aria-label="Tampilan kalender bulanan">
          <button
            type="button"
            onClick={() => setView("calendar")}
            aria-pressed={view === "calendar"}
            aria-label="Tampilan kalender"
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition ${view === "calendar" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}
          >
            <CalendarDays size={14} />
            <span>Kalender</span>
          </button>
          <button
            type="button"
            onClick={() => setView("daily")}
            aria-pressed={view === "daily"}
            aria-label="Tampilan harian"
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition ${view === "daily" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}
          >
            <List size={14} />
            <span>Harian</span>
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="mt-4 grid grid-cols-7 gap-1.5" style={{ height: contentHeight, gridTemplateRows: `24px repeat(${weekCount}, minmax(62px, 1fr))` }}>
          {weekdays.map((day) => <div key={day} className="py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-600">{day}</div>)}
          {calendarCells.map((cell, index) => cell ? (
            <a key={cell.day} href={`/transactions?from=${calendar.month}-${String(cell.day).padStart(2, "0")}&to=${calendar.month}-${String(cell.day).padStart(2, "0")}`} aria-label={`Lihat transaksi tanggal ${cell.day} ${calendar.label}`} className={`min-h-0 rounded-lg border px-1.5 py-1.5 transition hover:border-emerald-400/50 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${cell.isToday ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/5 bg-[#0a1119]"}`}>
              <div className="text-[10px] font-semibold text-slate-400">{cell.day}</div>
              {cell.income > 0 && <div className="mt-1 truncate text-[9px] font-semibold text-emerald-300">+{formatCompactCurrency(cell.income, currencyCode)}</div>}
              {cell.expense > 0 && <div className="truncate text-[9px] font-semibold text-red-300">−{formatCompactCurrency(cell.expense, currencyCode)}</div>}
            </a>
          ) : <div key={`blank-${index}`} />)}
        </div>
      ) : (
        <div className="mt-4 overflow-y-auto overscroll-contain pr-1" style={{ height: contentHeight }} aria-label={`Pengeluaran harian ${calendar.label}`}>
          {calendar.days.map((day) => {
            const date = new Date(Date.UTC(year, month - 1, day.day));
            const dateLabel = dailyDateFormatter.format(date);
            return (
              <a key={day.day} href={`/transactions?from=${calendar.month}-${String(day.day).padStart(2, "0")}&to=${calendar.month}-${String(day.day).padStart(2, "0")}`} aria-label={`Lihat transaksi tanggal ${dateLabel}`} className={`flex min-h-[52px] items-center justify-between gap-3 border-b border-white/5 px-2.5 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${day.isToday ? "rounded-lg bg-emerald-500/10" : ""}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`w-[22px] shrink-0 text-center text-xs font-bold ${day.isToday ? "text-emerald-300" : "text-slate-400"}`}>{day.day}</span>
                  <span className="truncate text-xs font-medium text-slate-300">{dateLabel}{day.isToday ? <span className="ml-1.5 text-[9px] font-semibold uppercase text-emerald-400">Hari ini</span> : null}</span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-red-300">−{formatCompactCurrency(day.expense, currencyCode)}</p>
                  {day.income > 0 && <p className="mt-0.5 text-[10px] font-medium text-emerald-300">+{formatCompactCurrency(day.income, currencyCode)} income</p>}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
