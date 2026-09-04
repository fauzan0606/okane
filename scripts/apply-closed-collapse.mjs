import fs from "node:fs";

const uiPath = "modules/investment/components/InvestmentDashboardV6.tsx";
let ui = fs.readFileSync(uiPath, "utf8");

if (!ui.includes("const [closedSummaryOpen, setClosedSummaryOpen]")) {
  const stateRegex = /const\s+\[closedTransactionsOpen,\s*setClosedTransactionsOpen\]\s*=\s*useState\(false\);/;
  const match = ui.match(stateRegex);
  if (!match) throw new Error("Closed transaction collapse state not found.");
  ui = ui.replace(match[0], match[0] + ' const [closedSummaryOpen, setClosedSummaryOpen] = useState(true); const [closedDetailOpen, setClosedDetailOpen] = useState(true);');
}

const startMarker = '<div className={card}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Transaction Detail';
const endMarker = '<div className={card}><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-white">Dividend Detail';
const start = ui.indexOf(startMarker);
const end = ui.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) throw new Error("Transaction Detail section boundaries not found.");

const clean = `<div className={card}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Transaction Detail{selectedAssetId ? \` · \${assetSummaries.find(a => a.asset.id === selectedAssetId)?.asset.symbol || "Asset"}\` : ""}</h2>
            <p className="text-xs text-slate-600">Open positions selalu berada di atas.</p>
          </div>
          {selectedAssetId && <button type="button" onClick={() => setSelectedAssetId("")} className="text-xs text-slate-400">Clear filter</button>}
        </div>

        <button type="button" onClick={() => setOpenPositionsOpen(v => !v)} className="flex w-full items-center justify-between rounded-xl border border-emerald-400/10 bg-emerald-400/[.02] p-3 text-left text-xs text-slate-400 hover:bg-emerald-400/[.04]">
          <span>OPEN POSITIONS · {selectedOpenRows.length}</span>
          <span className="text-slate-500">{openPositionsOpen ? "Collapse ↑" : "Expand ↓"}</span>
        </button>

        {openPositionsOpen && (
          selectedOpenRows.length ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Date</th><th>Asset</th><th>Buy</th><th>Remaining</th><th>Current</th><th>Min. Sell</th><th>P/L</th><th className="text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {selectedOpenRows.map(r => (
                    <tr key={r.lotId}>
                      <td className="px-3 py-3 text-slate-400">{new Date(r.transactionDate).toLocaleDateString("id-ID")}</td>
                      <td className="font-semibold text-white">{r.asset.symbol || r.asset.name}</td>
                      <td>{money(r.unitPrice, selected.currency.code)}</td>
                      <td>{nf(Number(r.remainingQuantity) / unitsPerLot(r.asset), 0)} lot</td>
                      <td>{r.currentPrice == null ? "—" : money(r.currentPrice, selected.currency.code)}</td>
                      <td className="text-amber-300">{money(r.minimumSellPrice, selected.currency.code)}</td>
                      <td className={Number(r.unrealizedGainLoss) >= 0 ? "text-emerald-300" : "text-red-300"}>{money(r.unrealizedGainLoss, selected.currency.code)}</td>
                      <td className="text-right whitespace-nowrap"><button type="button" onClick={() => openTrade("SELL", r)} className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[10px] font-bold text-[#07110b]">Sell / Split</button><button type="button" onClick={() => deleteTransaction(r.id)} className="ml-2 rounded-lg border border-red-400/20 px-3 py-1.5 text-[10px] font-bold text-red-300">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-8 text-center text-xs text-slate-600">Tidak ada open position.</div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-xs text-slate-500">CLOSED TRANSACTIONS · {selectedClosed.length}</span>
            <select aria-label="Filter closed transactions by asset" className="w-full max-w-[220px] rounded-lg border border-white/10 bg-[#101923] px-3 py-2 text-xs text-slate-300 outline-none" value={closedAssetId} onChange={e => setClosedAssetId(e.target.value)}>
              <option value="">All Assets</option>
              {closedAssets.slice().sort((a, b) => String(a.symbol || a.name).localeCompare(String(b.symbol || b.name), "id", { sensitivity: "base" })).map(asset => <option key={asset.id} value={asset.id}>{asset.symbol || asset.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setClosedTransactionsOpen(v => !v)} className="shrink-0 text-xs text-slate-500 hover:text-slate-300">{closedTransactionsOpen ? "Collapse ↑" : "Expand ↓"}</button>
        </div>

        {closedTransactionsOpen && (
          <>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[.015] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED SUMMARY</span>
                <button type="button" onClick={() => setClosedSummaryOpen(v => !v)} className="text-xs text-slate-500 hover:text-slate-300">{closedSummaryOpen ? "Collapse ↑" : "Expand ↓"}</button>
              </div>
              {closedSummaryOpen && (
                <div className="overflow-x-auto">
                  {closedSummary.length > 0 ? (
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Sold Qty</th><th>Avg Buy</th><th>Avg Sell</th><th>Net P/L</th><th>P/L %</th></tr></thead>
                      <tbody className="divide-y divide-white/5">{closedSummary.map(s => <tr key={s.asset.id}><td className="px-3 py-3 font-semibold text-white">{s.asset.symbol || s.asset.name}</td><td>{nf(s.soldQuantity / unitsPerLot(s.asset), 0)} lot</td><td>{money(s.avgBuy, selected.currency.code)}</td><td>{money(s.avgSell, selected.currency.code)}</td><td className={s.netPnl >= 0 ? "text-emerald-300" : "text-red-300"}>{money(s.netPnl, selected.currency.code)}</td><td className={s.pnlPct >= 0 ? "text-emerald-300" : "text-red-300"}>{nf(s.pnlPct, 2)}%</td></tr>)}</tbody>
                    </table>
                  ) : <div className="p-6 text-center text-xs text-slate-600">Tidak ada closed transaction.</div>}
                </div>
              )}
            </div>

            {selectedClosed.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[.015] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED DETAIL</span>
                  <button type="button" onClick={() => setClosedDetailOpen(v => !v)} className="text-xs text-slate-500 hover:text-slate-300">{closedDetailOpen ? "Collapse ↑" : "Expand ↓"}</button>
                </div>
                {closedDetailOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Sell Date</th><th>Asset</th><th>Sold Qty</th><th>Avg Buy</th><th>Sell Price</th><th>Holding Period</th><th>Net P/L</th><th>P/L %</th><th className="text-right">Action</th></tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {selectedClosed.map(x => {
                          const buyCost = Number(x.lot.totalCost) * Number(x.sale.quantity) / Math.max(Number(x.lot.quantity), 1);
                          const realized = Number(x.sale.realized);
                          const pnlPct = buyCost !== 0 ? (realized / buyCost) * 100 : 0;
                          const holdingDays = Math.max(0, Math.floor((new Date(x.sale.date).getTime() - new Date(x.lot.transactionDate).getTime()) / 86400000));
                          return <tr key={x.sale.id}><td className="px-3 py-3 whitespace-nowrap text-slate-400">{new Date(x.sale.date).toLocaleDateString("id-ID")}</td><td className="font-semibold text-white">{x.lot.asset.symbol || x.lot.asset.name}</td><td>{nf(Number(x.sale.quantity) / unitsPerLot(x.lot.asset), 0)} lot</td><td>{money(x.lot.unitPrice, selected.currency.code)}</td><td>{money(x.sale.price, selected.currency.code)}</td><td className="whitespace-nowrap">{holdingDays} days</td><td className={realized >= 0 ? "text-emerald-300" : "text-red-300"}>{money(realized, selected.currency.code)}</td><td className={pnlPct >= 0 ? "text-emerald-300" : "text-red-300"}>{nf(pnlPct, 2)}%</td><td className="text-right whitespace-nowrap"><button type="button" onClick={() => { const d = new Date(x.sale.date).toISOString().slice(0, 10); setClosedEdit({ id: x.sale.id, asset: x.lot.asset, quantity: Number(x.sale.quantity), date: d, price: Number(x.sale.price) }); setClosedEditDate(d); setClosedEditPrice(String(x.sale.price)); setClosedEditTax("0"); setClosedEditOther("0"); }} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-300">Edit</button><button type="button" onClick={() => deleteClosedTransaction(x.sale.id)} className="ml-2 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300">Delete</button></td></tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      `;

ui = ui.slice(0, start) + clean + ui.slice(end);
fs.writeFileSync(uiPath, ui);
console.log("Rebuilt Transaction Detail JSX with safe explicit conditional blocks.");
