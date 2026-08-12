import type { WalletHistoryEntry } from "../repository";

type WalletHistoryProps = {
  entries: WalletHistoryEntry[];
  symbol: string;
  decimalPlaces: number;
};

function money(value: string, symbol: string, decimalPlaces: number) {
  return `${symbol}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(value))}`;
}

export default function WalletHistory({ entries, symbol, decimalPlaces }: WalletHistoryProps) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#30465D] bg-[#0B141F]">
      <div className="border-b border-[#30465D] px-4 py-3">
        <h4 className="text-sm font-semibold text-white">Transaction History</h4>
        <p className="mt-0.5 text-[11px] text-slate-500">All transactions and transfers using this wallet.</p>
      </div>
      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-slate-500">No transaction history yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-[#0E1722] text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry) => (
                <tr key={entry.id} className="transition hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(entry.date))}</td>
                  <td className="px-4 py-3 font-medium text-slate-200">{entry.description}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-red-300">{Number(entry.debit) > 0 ? money(entry.debit, symbol, decimalPlaces) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-300">{Number(entry.credit) > 0 ? money(entry.credit, symbol, decimalPlaces) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-white">{money(entry.balance, symbol, decimalPlaces)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
