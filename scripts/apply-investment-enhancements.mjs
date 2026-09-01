import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function write(rel, text) {
  fs.writeFileSync(path.join(root, rel), text);
}
function replaceOnce(text, needle, replacement, label) {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`Anchor not found: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + needle.length);
}
function backup(rel) {
  const source = path.join(root, rel);
  const target = `${source}.backup-before-investment-enhancements`;
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
}

const v6Path = "modules/investment/components/InvestmentDashboardV6.tsx";
const v3Path = "modules/investment/service-v3.ts";
const v2Path = "app/api/investments/v2/route.ts";

for (const file of [v6Path, v3Path, v2Path]) backup(file);

let v3 = read(v3Path);

// Allow zero-price SELLs while retaining strict validation for BUYs.
v3 = replaceOnce(
  v3,
  'const unitPrice = positive(input.unitPrice, "Unit price");',
  'const unitPrice = input.transactionType === "SELL"\n    ? (Number.isFinite(input.unitPrice) && input.unitPrice >= 0 ? new D(input.unitPrice) : (() => { throw new Error("Unit price cannot be negative."); })())\n    : positive(input.unitPrice, "Unit price");',
  "service-v3 unit price validation",
);
write(v3Path, v3);

let v6 = read(v6Path);

// State for the user-selectable Asset Summary layout and dividend modal.
v6 = replaceOnce(
  v6,
  'const [importing, setImporting] = useState(false);',
  'const [importing, setImporting] = useState(false); const [assetSummaryView, setAssetSummaryView] = useState<"cards" | "table">("cards"); const [showDividend, setShowDividend] = useState(false); const [dividendAssetId, setDividendAssetId] = useState(""); const [dividendAmount, setDividendAmount] = useState(""); const [dividendDate, setDividendDate] = useState(today()); const [dividendDestination, setDividendDestination] = useState("");',
  "V6 enhancement state",
);

// Persist the Asset Summary display preference per browser.
v6 = replaceOnce(
  v6,
  'useEffect(() => { reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments.")); fetch("/api/investments/cash-transfer", { cache: "no-store" }).then(r => r.json()).then(j => setWallets(j.wallets ?? [])).catch(() => undefined); }, []);',
  'useEffect(() => { reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments.")); fetch("/api/investments/cash-transfer", { cache: "no-store" }).then(r => r.json()).then(j => setWallets(j.wallets ?? [])).catch(() => undefined); const savedView = window.localStorage.getItem("okane.assetSummaryView"); if (savedView === "cards" || savedView === "table") setAssetSummaryView(savedView); }, []);',
  "V6 initial preference load",
);

// Allow a zero price for SELL in the UI and API request validation.
v6 = replaceOnce(
  v6,
  'const canSubmit = !!trade.assetQuery.trim() && qty > 0 && price > 0 && !!trade.fundingCashAccountId && (trade.type === "BUY" || (!!sellLot && quantityValid));',
  'const canSubmit = !!trade.assetQuery.trim() && qty > 0 && (trade.type === "SELL" ? price >= 0 : price > 0) && !!trade.fundingCashAccountId && (trade.type === "BUY" || (!!sellLot && quantityValid));',
  "TradeModal zero-price sell validation",
);
v6 = replaceOnce(
  v6,
  'type="number" min="0.01" step="0.01" value={trade.unitPrice}',
  'type="number" min={trade.type === "SELL" ? "0" : "0.01"} step="0.01" value={trade.unitPrice}',
  "TradeModal price input",
);
v6 = replaceOnce(
  v6,
  'if (!asset || !trade.quantity || !trade.unitPrice || !trade.fundingCashAccountId) return setMessage("Lengkapi asset, quantity, harga dan RDN.");',
  'if (!asset || !trade.quantity || (trade.type === "BUY" && !trade.unitPrice) || trade.unitPrice === "" || !trade.fundingCashAccountId) return setMessage("Lengkapi asset, quantity, harga dan RDN.");',
  "submitTrade zero-price validation",
);

// Alphabetical Asset Summary ordering.
v6 = replaceOnce(
  v6,
  '}).sort((a, b) => b.marketValue - a.marketValue); }, [ledger, selected]);',
  '}).sort((a, b) => (a.asset.symbol || a.asset.name).localeCompare(b.asset.symbol || b.asset.name, "id", { sensitivity: "base" })); }, [ledger, selected]);',
  "Asset Summary alphabetical sort",
);

// Add a direct Dividend action beside New transaction.
v6 = replaceOnce(
  v6,
  '<button type="button" onClick={()=>openTrade("BUY")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ New transaction</button>',
  '<div className="flex gap-2"><button type="button" onClick={()=>{setDividendAssetId(selectedAssetId || assetSummaries[0]?.asset.id || "");setDividendAmount("");setDividendDate(today());setDividendDestination(selected.cashAccount?.id || "");setShowDividend(true);}} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-300">+ Dividend</button><button type="button" onClick={()=>openTrade("BUY")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ New transaction</button></div>',
  "Dividend button",
);

// Add Cards / Table view selector.
v6 = replaceOnce(
  v6,
  '<div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2><p className="text-xs text-slate-600">Satu baris = satu asset, gabungan seluruh lot yang masih dimiliki.</p></div>',
  '<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2><p className="text-xs text-slate-600">Satu baris = satu asset, gabungan seluruh lot yang masih dimiliki.</p></div><div className="flex items-center gap-2"> <div className="flex rounded-lg border border-white/10 bg-white/[.02] p-1"><button type="button" onClick={()=>{setAssetSummaryView("cards");window.localStorage.setItem("okane.assetSummaryView","cards");}} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${assetSummaryView === "cards" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>▦ Cards</button><button type="button" onClick={()=>{setAssetSummaryView("table");window.localStorage.setItem("okane.assetSummaryView","table");}} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${assetSummaryView === "table" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>☷ Table</button></div></div>',
  "Asset Summary view selector",
);

// Replace the card-only body with a Cards/Table switch while retaining the existing card markup.
const cardStart = '<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{assetSummaries.map(s =>';
const cardEnd = '</div>:<div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-600">Belum ada open position.</div>}</div>';
const start = v6.indexOf(cardStart);
if (start < 0) throw new Error("Asset Summary card body anchor not found.");
const afterStart = v6.indexOf(cardEnd, start);
if (afterStart < 0) throw new Error("Asset Summary card body end anchor not found.");
const existingBody = v6.slice(start + '<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">'.length, afterStart + '</div>'.length);
const tableBody = '{assetSummaryView === "cards" ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">' + existingBody.replace(/^\{assetSummaries\.map/, '{assetSummaries.map') + ' : <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Value</th><th>Min. Sell</th><th>P/L</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{assetSummaries.map(s => <tr key={s.asset.id} className={selectedAssetId===s.asset.id?"bg-emerald-400/[.03]":""} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><td className="px-3 py-3"><p className="font-semibold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></td><td>{nf(s.quantity/unitsPerLot(s.asset),0)} lot</td><td>{money(s.avgCost,selected.currency.code)}</td><td>{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</td><td>{money(s.marketValue,selected.currency.code)}</td><td className="text-amber-300">{money(s.minSell,selected.currency.code)}</td><td className={s.pnl>=0?"text-emerald-300":"text-red-300"}>{money(s.pnl,selected.currency.code)}</td><td className="text-right pr-3"><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="rounded-lg border border-emerald-400/20 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">Sell All</button></td></tr>)}</tbody></table></div>';
v6 = v6.slice(0, start) + tableBody + v6.slice(afterStart + cardEnd.length - '</div>'.length);

// Dividend recording handler, inserted before saveAccount.
v6 = replaceOnce(
  v6,
  'async function saveAccount(e: FormEvent) {',
  'async function saveDividend() { if (!selected || !dividendAssetId || !dividendAmount || !dividendDestination) return; const value = Number(dividendAmount); if (!Number.isFinite(value) || value <= 0) return setMessage("Dividend amount must be greater than zero."); const ok = await run({ action: "income.create", accountId: selected.id, assetId: dividendAssetId, type: "DIVIDEND", amount: value, date: new Date(dividendDate).toISOString(), destinationCashAccountId: dividendDestination }, "Dividend recorded."); if (ok) { setShowDividend(false); setDividendAmount(""); } }\n  async function saveAccount(e: FormEvent) {',
  "Dividend handler",
);

// Dividend modal, appended alongside existing modals.
v6 = replaceOnce(
  v6,
  '<SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} />',
  '<SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} />{selected&&showDividend&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={e=>{e.preventDefault();void saveDividend();}} className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">INVESTMENT INCOME</p><h2 className="mt-1 text-2xl font-bold text-white">Record Dividend</h2><p className="mt-1 text-xs text-slate-500">Dividend masuk ke RDN dan dihitung sebagai bagian dari Total Profit.</p></div><button type="button" onClick={()=>setShowDividend(false)} className="text-2xl text-slate-500">×</button></div><div className="mt-5 space-y-4"><label className="block text-xs text-slate-500">Asset<select className={`${select} mt-2`} value={dividendAssetId} onChange={e=>setDividendAssetId(e.target.value)}><option value="">Select asset</option>{assetSummaries.map(s=><option key={s.asset.id} value={s.asset.id}>{s.asset.symbol||s.asset.name}</option>)}</select></label><label className="block text-xs text-slate-500">Dividend amount<input className={`${input} mt-2`} type="number" min="0.01" step="0.01" value={dividendAmount} onChange={e=>setDividendAmount(e.target.value)} placeholder="100000" /></label><label className="block text-xs text-slate-500">Date<input className={`${input} mt-2`} type="date" value={dividendDate} onChange={e=>setDividendDate(e.target.value)} /></label><label className="block text-xs text-slate-500">Receive to RDN<select className={`${select} mt-2`} value={dividendDestination} onChange={e=>setDividendDestination(e.target.value)}><option value="">Select RDN</option>{selected.cashAccount&&<option value={selected.cashAccount.id}>{selected.name} · {money(selected.cashAccount.balance,selected.currency.code)}</option>}</select></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setShowDividend(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Cancel</button><button type="submit" disabled={busy||!dividendAssetId||!dividendAmount||!dividendDestination} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy?"Saving…":"Record dividend"}</button></div></form></div>}',
  "Dividend modal",
);

write(v6Path, v6);

console.log("Investment enhancements applied successfully.");
console.log("Modified:", v6Path, v3Path);
console.log("Backups created with .backup-before-investment-enhancements suffix.");
