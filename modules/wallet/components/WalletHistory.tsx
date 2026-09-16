import type { RefObject } from "react";
import type { WalletHistoryEntry } from "../repository";
import { formatWalletType } from "../constants";

const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-xs font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

type WalletHistoryProps = {
  historyRef: RefObject<HTMLElement | null>;
  entries: WalletHistoryEntry[];
  symbol: string;
  decimalPlaces: number;
  walletName: string;
  walletType: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

function money(value: string, symbol: string, decimalPlaces: number) {
  return `${symbol}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(value))}`;
}

export default function WalletHistory({ historyRef, entries, symbol, decimalPlaces, walletName, walletType, page, pageSize, total, totalPages, loading = false, onPageChange }: WalletHistoryProps) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <section ref={historyRef} className="scroll-mt-24 overflow-hidden rounded-[22px] border border-[#30465D] bg-[#172A3D] shadow-[0_12px_35px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 border-b border-[#30465D] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Selected Wallet</p>
          <h2 className="mt-1 text-xl font-bold text-white">{walletName}</h2>
          <p className="mt-1 text-xs text-slate-500">{formatWalletType(walletType as never)} · Transaction & balance movement history</p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#0B141F] px-3 py-1.5 text-xs font-medium text-slate-300">{total} {total === 1 ? "entry" : "entries"}</div>
      </div>

      {loading ? (
        <div className="space-y-3 px-5 py-5">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">No transaction history yet for this wallet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-[#0E1722] text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Description</th><th className="px-5 py-3 text-right font-medium">Debit</th><th className="px-5 py-3 text-right font-medium">Credit</th><th className="px-5 py-3 text-right font-medium">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry) => (
                <tr key={entry.id} className="transition hover:bg-white/[0.025]">
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-400">{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(entry.date))}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-200">{entry.description}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-red-300">{Number(entry.debit) > 0 ? money(entry.debit, symbol, decimalPlaces) : "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-emerald-300">{Number(entry.credit) > 0 ? money(entry.credit, symbol, decimalPlaces) : "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-white">{money(entry.balance, symbol, decimalPlaces)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Showing {firstItem}–{lastItem} of {total}</p>
          <div className="flex items-center gap-2">
            <button type="button" className={buttonClass} disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>← Previous</button>
            <span className="min-w-14 text-center text-xs font-semibold text-slate-300">{page} / {totalPages}</span>
            <button type="button" className={buttonClass} disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>Next →</button>
          </div>
        </div>
      )}
    </section>
  );
}
