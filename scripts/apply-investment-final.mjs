import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  v6: path.join(root, "modules/investment/components/InvestmentDashboardV6.tsx"),
  v3: path.join(root, "modules/investment/service-v3.ts"),
  v4: path.join(root, "app/api/investments/v4/route.ts"),
};
const changes = [];
function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, text) { fs.writeFileSync(file, text); }
function one(text, needle, replacement, label) {
  if (!text.includes(needle)) { changes.push(`SKIP ${label}`); return text; }
  changes.push(`OK ${label}`); return text.replace(needle, replacement);
}
function regex(text, re, replacement, label) {
  if (!re.test(text)) { changes.push(`SKIP ${label}`); return text; }
  changes.push(`OK ${label}`); return text.replace(re, replacement);
}

// Backend: SELL may use 0; BUY remains > 0.
let v3 = read(files.v3);
v3 = one(v3, 'const unitPrice = positive(input.unitPrice, "Unit price");', 'const unitPrice = input.transactionType === "SELL"\n    ? (Number.isFinite(input.unitPrice) && input.unitPrice >= 0 ? new D(input.unitPrice) : (() => { throw new Error("Unit price cannot be negative."); })())\n    : positive(input.unitPrice, "Unit price");', "service-v3 zero SELL");
write(files.v3, v3);

let v4 = read(files.v4);
v4 = v4.replace(/unitPrice <= 0/g, "unitPrice < 0").replace(/Sell price must be greater than zero\./g, "Sell price cannot be negative.");
changes.push("OK v4 zero SELL");
write(files.v4, v4);

let v6 = read(files.v6);

// State for cards/table preference and dividend income.
if (!v6.includes('const [assetSummaryView')) {
  v6 = regex(v6, /const \[importing, setImporting\] = useState\(false\);/, 'const [importing, setImporting] = useState(false); const [assetSummaryView, setAssetSummaryView] = useState<"cards" | "table">("cards"); const [showDividend, setShowDividend] = useState(false); const [dividendAssetId, setDividendAssetId] = useState(""); const [dividendAmount, setDividendAmount] = useState(""); const [dividendDate, setDividendDate] = useState(today()); const [dividendDestination, setDividendDestination] = useState(""); const [dividendByAccount, setDividendByAccount] = useState<Record<string, number>>({});', "V6 enhancement state");
}

if (!v6.includes('okane.assetSummaryView')) {
  v6 = regex(v6, /useEffect\(\(\) => \{ reload\(\)\.catch\(e => setMessage\(e instanceof Error \? e\.message : "Unable to load investments\."\)\); fetch\("\/api\/investments\/cash-transfer", \{ cache: "no-store" \}\)\.then\(r => r\.json\(\)\)\.then\(j => setWallets\(j\.wallets \?\? \[\]\)\)\.catch\(\(\) => undefined\); \}, \[\]\);/, 'useEffect(() => { reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments.")); fetch("/api/investments/cash-transfer", { cache: "no-store" }).then(r => r.json()).then(j => setWallets(j.wallets ?? [])).catch(() => undefined); const savedView = window.localStorage.getItem("okane.assetSummaryView"); if (savedView === "cards" || savedView === "table") setAssetSummaryView(savedView); }, []);', "V6 preference load");
}

// Zero-price SELL UI.
v6 = v6.replace(/const canSubmit = ([^;]*?)price > 0([^;]*);/, 'const canSubmit = $1(trade.type === "SELL" ? price >= 0 : price > 0)$2;');
v6 = v6.replace('type="number" min="0.01" step="0.01" value={trade.unitPrice}', 'type="number" min={trade.type === "SELL" ? "0" : "0.01"} step="0.01" value={trade.unitPrice}');
v6 = v6.replace('if (!asset || !trade.quantity || !trade.unitPrice || !trade.fundingCashAccountId)', 'if (!asset || !trade.quantity || trade.unitPrice === "" || !trade.fundingCashAccountId)');
v6 = v6.replace('type="number" min="0.01" step="0.01" value={price}', 'type="number" min="0" step="0.01" value={price}');
v6 = v6.replace('disabled={busy || p <= 0}', 'disabled={busy || p < 0}');
changes.push("OK V6 zero SELL UI");

// Alphabetical ordering.
v6 = v6.replace('}).sort((a, b) => b.marketValue - a.marketValue); }, [ledger, selected]);', '}).sort((a, b) => (a.asset.symbol || a.asset.name).localeCompare(b.asset.symbol || b.asset.name, "id", { sensitivity: "base" })); }, [ledger, selected]);');

// Add a real Cards/Table switch and table. This operates on the Asset Summary section only.
if (!v6.includes('setAssetSummaryView("table")')) {
  const sectionRe = /<div className=\{card\}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary<\/h2>[\s\S]*?(?=<div className=\{card\}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Transaction Detail)/;
  const replacement = `<div className={card}><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2><p className="text-xs text-slate-600">Satu baris = satu asset, gabungan seluruh lot yang masih dimiliki.</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg border border-white/10 bg-white/[.02] p-1"><button type="button" onClick={()=>{setAssetSummaryView("cards");window.localStorage.setItem("okane.assetSummaryView","cards");}} className={\`rounded-md px-3 py-1.5 text-[10px] font-bold \${assetSummaryView === "cards" ? "bg-white/[.08] text-white" : "text-slate-500"}\`}>▦ Cards</button><button type="button" onClick={()=>{setAssetSummaryView("table");window.localStorage.setItem("okane.assetSummaryView","table");}} className={\`rounded-md px-3 py-1.5 text-[10px] font-bold \${assetSummaryView === "table" ? "bg-white/[.08] text-white" : "text-slate-500"}\`}>☷ Table</button></div><button type="button" onClick={()=>{setDividendAssetId(selectedAssetId || assetSummaries[0]?.asset.id || "");setDividendAmount("");setDividendDate(today());setDividendDestination(selected.cashAccount?.id || "");setShowDividend(true);}} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-300">+ Dividend</button><button type="button" onClick={()=>openTrade("BUY")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ New transaction</button></div></div>{assetSummaries.length ? <>{assetSummaryView === "cards" ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{assetSummaries.map(s=><div key={s.asset.id} className={\`rounded-2xl border p-4 \${selectedAssetId===s.asset.id?"border-emerald-400/40 bg-emerald-400/[.04]":"border-white/10 bg-white/[.02]"}\`} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><div className="flex items-start justify-between"><div><p className="text-lg font-bold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></div><span className="text-xs text-slate-500">{nf(s.quantity/unitsPerLot(s.asset),0)} lot</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-600">Avg Cost</p><p className="mt-1 font-semibold text-white">{money(s.avgCost,selected.currency.code)}</p></div><div><p className="text-slate-600">Current</p><p className="mt-1 font-semibold text-white">{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</p></div><div><p className="text-slate-600">Value</p><p className="mt-1 font-semibold text-white">{money(s.marketValue,selected.currency.code)}</p></div><div><p className="text-slate-600">Min. Sell</p><p className="mt-1 font-semibold text-amber-300">{money(s.minSell,selected.currency.code)}</p></div></div><div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3"><span className="text-[10px] uppercase tracking-widest text-slate-600">Unrealized P/L</span><span className={\`text-sm font-bold \${s.pnl>=0?"text-emerald-300":"text-red-300"}\`}>{money(s.pnl,selected.currency.code)}</span></div><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="mt-3 rounded-lg border border-emerald-400/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Sell All</button></div>)}</div> : <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Market Value</th><th>Min. Sell</th><th>Unrealized P/L</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{assetSummaries.map(s=><tr key={s.asset.id} className={selectedAssetId===s.asset.id?"bg-emerald-400/[.03]":""} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><td className="px-3 py-3"><p className="font-semibold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></td><td>{nf(s.quantity/unitsPerLot(s.asset),0)} lot</td><td>{money(s.avgCost,selected.currency.code)}</td><td>{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</td><td>{money(s.marketValue,selected.currency.code)}</td><td className="text-amber-300">{money(s.minSell,selected.currency.code)}</td><td className={s.pnl>=0?"text-emerald-300":"text-red-300"}>{money(s.pnl,selected.currency.code)}</td><td className="px-3 text-right"><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="rounded-lg border border-emerald-400/20 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">Sell All</button></td></tr>)}</tbody></table></div>}</> : <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-600">Belum ada open position.</div>}</div>\n      `;
  v6 = v6.replace(sectionRe, replacement);
}

// Dividend total is derived from the account ledgers already exposed by v2.
if (!v6.includes('const totalDividend =')) {
  v6 = one(v6, 'const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0);', 'const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0); const totalDividend = Object.values(dividendByAccount).reduce((sum, value) => sum + value, 0); const totalProfit = totalRealized + totalDividend;', "V6 total profit values");
}
if (!v6.includes('setDividendByAccount(Object.fromEntries')) {
  const after = 'useEffect(() => { if (accountId) loadLedger(accountId).catch(e => setMessage(e instanceof Error ? e.message : "Unable to load transactions.")); else setLedger(null); }, [accountId]);';
  const effect = `useEffect(() => { if (!data) return; let cancelled = false; const loadDividends = async () => { const active = (data.accounts ?? []).filter(a => a.isActive !== false); const pairs = await Promise.all(active.map(async a => { try { const r = await fetch(\`/api/investments/v2?accountId=\${encodeURIComponent(a.id)}\`, { cache: "no-store" }); const j = await r.json(); const value = (j.transactions ?? []).filter((t: { transactionType?: string }) => t.transactionType === "DIVIDEND").reduce((sum: number, t: { netCashAmount?: string | number }) => sum + Math.max(0, Number(t.netCashAmount ?? 0) || 0), 0); return [a.id, value] as const; } catch { return [a.id, 0] as const; } })); if (!cancelled) setDividendByAccount(Object.fromEntries(pairs)); }; void loadDividends(); return () => { cancelled = true; }; }, [data]); `;
  v6 = one(v6, after, after + " " + effect, "V6 dividend aggregation effect");
}

if (!v6.includes('async function saveDividend()')) {
  v6 = one(v6, 'async function saveAccount(e: FormEvent) {', `async function saveDividend() { if (!selected || !dividendAssetId || !dividendAmount || !dividendDestination) return; const amount = Number(dividendAmount); if (!Number.isFinite(amount) || amount <= 0) return setMessage("Dividend amount must be greater than zero."); const ok = await run({ action: "income.create", accountId: selected.id, assetId: dividendAssetId, type: "DIVIDEND", amount, date: new Date(dividendDate).toISOString(), destinationCashAccountId: dividendDestination }, "Dividend recorded.", "v1"); if (ok) { setShowDividend(false); setDividendAmount(""); } }\n  async function saveAccount(e: FormEvent) {`, "V6 dividend handler");
}

v6 = v6.replace('async function run(body: Record<string, unknown>, success: string, route: "v2" | "v4" = "v2")', 'async function run(body: Record<string, unknown>, success: string, route: "v1" | "v2" | "v4" = "v2")');
v6 = v6.replace('if (route === "v4") await postV4(body); else await postV2(body);', 'if (route === "v4") await postV4(body); else if (route === "v1") { const r = await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Investment operation failed."); } else await postV2(body);');

if (!v6.includes('Record Dividend')) {
  v6 = one(v6, '<SellAllModal open={showSellAll}', '<ClosedDividendModal open={showDividend} account={selected} assets={assetSummaries.map(s=>s.asset)} assetId={dividendAssetId} amount={dividendAmount} date={dividendDate} destination={dividendDestination} setAssetId={setDividendAssetId} setAmount={setDividendAmount} setDate={setDividendDate} setDestination={setDividendDestination} onClose={()=>setShowDividend(false)} onSubmit={()=>void saveDividend()} busy={busy} /><SellAllModal open={showSellAll}', "V6 dividend modal placement");
  v6 = one(v6, 'function SellAllModal({', `function ClosedDividendModal({ open, account, assets, assetId, amount, date, destination, setAssetId, setAmount, setDate, setDestination, onClose, onSubmit, busy }: { open: boolean; account: Account | null; assets: Asset[]; assetId: string; amount: string; date: string; destination: string; setAssetId: (v: string) => void; setAmount: (v: string) => void; setDate: (v: string) => void; setDestination: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean }) { if (!open || !account) return null; return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">INVESTMENT INCOME</p><h2 className="mt-1 text-2xl font-bold text-white">Record Dividend</h2><p className="mt-1 text-xs text-slate-500">Dividend masuk ke RDN dan menjadi bagian dari Total Profit.</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-500">×</button></div><div className="mt-5 space-y-4"><label className="block text-xs text-slate-500">Asset<select className={select} value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Select asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.symbol||a.name}</option>)}</select></label><label className="block text-xs text-slate-500">Dividend amount<input className={input} type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label className="block text-xs text-slate-500">Date<input className={input} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label className="block text-xs text-slate-500">Receive to RDN<select className={select} value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Select RDN</option>{account.cashAccount&&<option value={account.cashAccount.id}>{account.name}</option>}</select></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Cancel</button><button type="button" disabled={busy||!assetId||!amount||!destination} onClick={onSubmit} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy?"Saving…":"Record dividend"}</button></div></div></div>; }\n\nfunction SellAllModal({`, "V6 dividend modal");
}

write(files.v6, v6);
fs.writeFileSync(path.join(root, "investment-enhancement-apply-log.txt"), changes.join("\n") + "\n");
console.log(changes.join("\n"));
