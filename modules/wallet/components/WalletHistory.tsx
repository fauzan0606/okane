import type { WalletHistoryEntry } from "../repository";
import { formatWalletType } from "../constants";

type WalletHistoryProps = {
  entries: WalletHistoryEntry[];
  symbol: string;
  decimalPlaces: number;
  walletName: string;
  walletType: string;
};

function money(value: string, symbol: string, decimalPlaces: number) {
  return `${symbol}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(value))}`;
}

export default function WalletHistory({ entries, symbol, decimalPlaces, walletName, walletType }: WalletHistoryProps) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#30465D] bg-[#172A3D] shadow-[0_12px_35px_rgba(0,0,0,0.22)]">
      <div className="flex items-end justify-between gap-4 border-b border-[#30465D] px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Selected Wallet</p>
          <h2 className="mt-1 text-xl font-bold text-white">{walletName}</h2>
          <p className="mt-1 text-xs text-slate-500">{formatWalletType(walletType as never)} · Transaction & balance movement history</p>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-[#0B141F] px-3 py-1.5 text-xs font-medium text-slate-300 sm:block">{entries.length} {entries.length === 1 ? "entry" : "entries"}</div>
      </div>
      {entries.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">No transaction history yet for this wallet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-[#0E1722] text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium">Debit</th>
                <th className="px-5 py-3 text-right font-medium">Credit</th>
                <th className="px-5 py-3 text-right font-medium">Balance</th>
              </tr>
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
    </section>
  );
}
