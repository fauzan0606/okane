import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const v6Path = path.join(root, "modules/investment/components/InvestmentDashboardV6.tsx");
const v3Path = path.join(root, "modules/investment/service-v3.ts");
const v4Path = path.join(root, "app/api/investments/v4/route.ts");

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, content) { fs.writeFileSync(file, content); }
function replaceOnce(content, needle, replacement, label) {
  if (!content.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return content.replace(needle, replacement);
}
function replaceRegex(content, regex, replacement, label) {
  if (!regex.test(content)) throw new Error(`Regex anchor not found: ${label}`);
  return content.replace(regex, replacement);
}

let v3 = read(v3Path);
if (v3.includes('const unitPrice = positive(input.unitPrice, "Unit price");')) {
  v3 = replaceOnce(v3,
    'const unitPrice = positive(input.unitPrice, "Unit price");',
    'const unitPrice = input.transactionType === "SELL"\n    ? (Number.isFinite(input.unitPrice) && input.unitPrice >= 0 ? new D(input.unitPrice) : (() => { throw new Error("Unit price cannot be negative."); })())\n    : positive(input.unitPrice, "Unit price");',
    "service-v3 SELL zero price"
  );
}
write(v3Path, v3);

let v4 = read(v4Path);
if (v4.includes('unitPrice <= 0')) {
  v4 = v4.replace('unitPrice <= 0', 'unitPrice < 0');
  v4 = v4.replace('Sell price must be greater than zero.', 'Sell price cannot be negative.');
}
write(v4Path, v4);

let v6 = read(v6Path);

// Frontend state.
if (!v6.includes('const [assetSummaryView')) {
  v6 = replaceOnce(v6,
    'const [importing, setImporting] = useState(false);',
    'const [importing, setImporting] = useState(false); const [assetSummaryView, setAssetSummaryView] = useState<"cards" | "table">("cards"); const [showDividend, setShowDividend] = useState(false); const [dividendAssetId, setDividendAssetId] = useState(""); const [dividendAmount, setDividendAmount] = useState(""); const [dividendDate, setDividendDate] = useState(today()); const [dividendDestination, setDividendDestination] = useState(""); const [dividendByAccount, setDividendByAccount] = useState<Record<string, number>>({});',
    "V6 enhancement state"
  );
}

if (!v6.includes('okane.assetSummaryView')) {
  v6 = replaceOnce(v6,
    'useEffect(() => { reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments.")); fetch("/api/investments/cash-transfer", { cache: "no-store" }).then(r => r.json()).then(j => setWallets(j.wallets ?? [])).catch(() => undefined); }, []);',
    'useEffect(() => { reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments.")); fetch("/api/investments/cash-transfer", { cache: "no-store" }).then(r => r.json()).then(j => setWallets(j.wallets ?? [])).catch(() => undefined); const savedView = window.localStorage.getItem("okane.assetSummaryView"); if (savedView === "cards" || savedView === "table") setAssetSummaryView(savedView); }, []);',
    "V6 asset summary preference"
  );
}

// Zero-price SELL in modal and Sell All.
v6 = v6.replace(
  'const canSubmit = !!trade.assetQuery.trim() && qty > 0 && price > 0 && !!trade.fundingCashAccountId && (trade.type === "BUY" || (!!sellLot && quantityValid));',
  'const canSubmit = !!trade.assetQuery.trim() && qty > 0 && (trade.type === "SELL" ? price >= 0 : price > 0) && !!trade.fundingCashAccountId && (trade.type === "BUY" || (!!sellLot && quantityValid));'
);
v6 = v6.replace(
  'type="number" min="0.01" step="0.01" value={trade.unitPrice}',
  'type="number" min={trade.type === "SELL" ? "0" : "0.01"} step="0.01" value={trade.unitPrice}'
);
v6 = v6.replace(
  'if (!asset || !trade.quantity || !trade.unitPrice || !trade.fundingCashAccountId) return setMessage("Lengkapi asset, quantity, harga dan RDN.");',
  'if (!asset || !trade.quantity || trade.unitPrice === "" || !trade.fundingCashAccountId) return setMessage("Lengkapi asset, quantity, harga dan RDN.");'
);
v6 = v6.replace('type="number" min="0.01" step="0.01" value={price}', 'type="number" min="0" step="0.01" value={price}');
v6 = v6.replace('disabled={busy || p <= 0}', 'disabled={busy || p < 0}');

// Alphabetic asset summary ordering.
v6 = v6.replace(
  '}).sort((a, b) => b.marketValue - a.marketValue); }, [ledger, selected]);',
  '}).sort((a, b) => (a.asset.symbol || a.asset.name).localeCompare(b.asset.symbol || b.asset.name, "id", { sensitivity: "base" })); }, [ledger, selected]);'
);

// Capture dividend income from the same account ledger already loaded for realized P/L.
if (!v6.includes('setDividendByAccount(Object.fromEntries')) {
  v6 = replaceRegex(v6,
    /const values = await Promise\.all\([\s\S]*?if \(!cancelled\) \{\s*setRealizedByAccount\(Object\.fromEntries\(values\)\);\s*\}/,
    `const values = await Promise.all(\n        active.map(async account => {\n          try {\n            const r = await fetch(\`/api/investments/v2?accountId=\${encodeURIComponent(account.id)}\`, { cache: "no-store" });\n            const j = await r.json();\n            const realized = Number(j.summary?.realizedGainLoss ?? 0) || 0;\n            const dividend = (j.transactions ?? []).filter((t: { transactionType?: string }) => t.transactionType === "DIVIDEND").reduce((sum: number, t: { netCashAmount?: string | number }) => sum + Math.max(0, Number(t.netCashAmount ?? 0) || 0), 0);\n            return [account.id, { realized, dividend }] as const;\n          } catch {\n            return [account.id, { realized: 0, dividend: 0 }] as const;\n          }\n        })\n      );\n\n      if (!cancelled) {\n        setRealizedByAccount(Object.fromEntries(values.map(([id, value]) => [id, value.realized])));\n        setDividendByAccount(Object.fromEntries(values.map(([id, value]) => [id, value.dividend])));\n      }`,
    "V6 realized/dividend aggregation"
  );
}

// Add dividend action and modal once.
if (!v6.includes('async function saveDividend()')) {
  v6 = replaceOnce(v6,
    'async function saveAccount(e: FormEvent) {',
    `async function saveDividend() {\n    if (!selected || !dividendAssetId || !dividendAmount || !dividendDestination) return;\n    const amount = Number(dividendAmount);\n    if (!Number.isFinite(amount) || amount <= 0) return setMessage("Dividend amount must be greater than zero.");\n    const ok = await run({ action: "income.create", accountId: selected.id, assetId: dividendAssetId, type: "DIVIDEND", amount, date: new Date(dividendDate).toISOString(), destinationCashAccountId: dividendDestination }, "Dividend recorded.", "v1");\n    if (ok) { setShowDividend(false); setDividendAmount(""); }\n  }\n\n  async function saveAccount(e: FormEvent) {`,
    "V6 dividend handler"
  );
}

// run() needs v1 route support for Dividend.
v6 = v6.replace(
  'async function run(body: Record<string, unknown>, success: string, route: "v2" | "v4" = "v2")',
  'async function run(body: Record<string, unknown>, success: string, route: "v1" | "v2" | "v4" = "v2")'
);
v6 = v6.replace(
  'if (route === "v4") await postV4(body); else await postV2(body);',
  'if (route === "v4") await postV4(body); else if (route === "v1") { const r = await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Investment operation failed."); } else await postV2(body);'
);

// Replace Asset Summary section with a real React Cards/Table switch.
if (!v6.includes('setAssetSummaryView("table")')) {
  const start = v6.indexOf('<div className={card}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2>');
  const end = v6.indexOf('<div className={card}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Transaction Detail', start);
  if (start < 0 || end < 0) throw new Error("Asset Summary section boundaries not found.");
  const replacement = `<div className={card}><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2><p className="text-xs text-slate-600">Satu baris = satu asset, gabungan seluruh lot yang masih dimiliki.</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg border border-white/10 bg-white/[.02] p-1"><button type="button" onClick={()=>{setAssetSummaryView("cards");window.localStorage.setItem("okane.assetSummaryView","cards");}} className={\`rounded-md px-3 py-1.5 text-[10px] font-bold \${assetSummaryView === "cards" ? "bg-white/[.08] text-white" : "text-slate-500"}\`}>▦ Cards</button><button type="button" onClick={()=>{setAssetSummaryView("table");window.localStorage.setItem("okane.assetSummaryView","table");}} className={\`rounded-md px-3 py-1.5 text-[10px] font-bold \${assetSummaryView === "table" ? "bg-white/[.08] text-white" : "text-slate-500"}\`}>☷ Table</button></div><button type="button" onClick={()=>{setDividendAssetId(selectedAssetId || assetSummaries[0]?.asset.id || "");setDividendAmount("");setDividendDate(today());setDividendDestination(selected.cashAccount?.id || "");setShowDividend(true);}} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-300">+ Dividend</button><button type="button" onClick={()=>openTrade("BUY")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ New transaction</button></div></div>{assetSummaries.length ? (assetSummaryView === "cards" ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{assetSummaries.map(s=><div key={s.asset.id} className={\`rounded-2xl border p-4 \${selectedAssetId===s.asset.id?"border-emerald-400/40 bg-emerald-400/[.04]":"border-white/10 bg-white/[.02]"}\`} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><div className="flex items-start justify-between"><div><p className="text-lg font-bold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></div><span className="text-xs text-slate-500">{nf(s.quantity/unitsPerLot(s.asset),0)} lot</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-600">Avg Cost</p><p className="mt-1 font-semibold text-white">{money(s.avgCost,selected.currency.code)}</p></div><div><p className="text-slate-600">Current</p><p className="mt-1 font-semibold text-white">{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</p></div><div><p className="text-slate-600">Value</p><p className="mt-1 font-semibold text-white">{money(s.marketValue,selected.currency.code)}</p></div><div><p className="text-slate-600">Min. Sell</p><p className="mt-1 font-semibold text-amber-300">{money(s.minSell,selected.currency.code)}</p></div></div><div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3"><span className="text-[10px] uppercase tracking-widest text-slate-600">Unrealized P/L</span><span className={\`text-sm font-bold \${s.pnl>=0?"text-emerald-300":"text-red-300"}\`}>{money(s.pnl,selected.currency.code)}</span></div><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="mt-3 rounded-lg border border-emerald-400/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Sell All</button></div>)}</div> : <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Market Value</th><th>Min. Sell</th><th>Unrealized P/L</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{assetSummaries.map(s=><tr key={s.asset.id} className={selectedAssetId===s.asset.id?"bg-emerald-400/[.03]":""} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><td className="px-3 py-3"><p className="font-semibold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></td><td>{nf(s.quantity/unitsPerLot(s.asset),0)} lot</td><td>{money(s.avgCost,selected.currency.code)}</td><td>{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</td><td>{money(s.marketValue,selected.currency.code)}</td><td className="text-amber-300">{money(s.minSell,selected.currency.code)}</td><td className={s.pnl>=0?"text-emerald-300":"text-red-300"}>{money(s.pnl,selected.currency.code)}</td><td className="px-3 text-right"><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="rounded-lg border border-emerald-400/20 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">Sell All</button></td></tr>)}</tbody></table></div>) : <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-600">Belum ada open position.</div>}</div>\n      `;
  v6 = v6.slice(0, start) + replacement + v6.slice(end);
}

// Add Dividend modal at the end of the component.
if (!v6.includes('Record Dividend')) {
  v6 = replaceOnce(v6,
    '<SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} />',
    '<SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} /><ClosedDividendModal open={showDividend} account={selected} assets={assetSummaries.map(s=>s.asset)} assetId={dividendAssetId} amount={dividendAmount} date={dividendDate} destination={dividendDestination} setAssetId={setDividendAssetId} setAmount={setDividendAmount} setDate={setDividendDate} setDestination={setDividendDestination} onClose={()=>setShowDividend(false)} onSubmit={()=>void saveDividend()} busy={busy} />',
    "V6 dividend modal placement"
  );
  v6 = v6.replace(
    'function SellAllModal({',
    `function ClosedDividendModal({ open, account, assets, assetId, amount, date, destination, setAssetId, setAmount, setDate, setDestination, onClose, onSubmit, busy }: { open: boolean; account: Account | null; assets: Asset[]; assetId: string; amount: string; date: string; destination: string; setAssetId: (v: string) => void; setAmount: (v: string) => void; setDate: (v: string) => void; setDestination: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean }) { if (!open || !account) return null; return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">INVESTMENT INCOME</p><h2 className="mt-1 text-2xl font-bold text-white">Record Dividend</h2><p className="mt-1 text-xs text-slate-500">Dividend menambah RDN dan diperhitungkan dalam Total Profit.</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-500">×</button></div><div className="mt-5 space-y-4"><label className="block text-xs text-slate-500">Asset<select className={select} value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Select asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.symbol||a.name}</option>)}</select></label><label className="block text-xs text-slate-500">Dividend amount<input className={input} type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="100000" /></label><label className="block text-xs text-slate-500">Date<input className={input} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label className="block text-xs text-slate-500">Receive to RDN<select className={select} value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Select RDN</option>{account.cashAccount&&<option value={account.cashAccount.id}>{account.name}</option>}</select></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Cancel</button><button type="button" disabled={busy||!assetId||!amount||!destination} onClick={onSubmit} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy?"Saving…":"Record dividend"}</button></div></div></div>; }\n\nfunction SellAllModal({`
  );
}

// Overview: Dividend Income + Total Profit cards.
if (!v6.includes('const totalDividend =')) {
  v6 = replaceOnce(v6,
    'const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0);',
    'const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0); const totalDividend = Object.values(dividendByAccount).reduce((sum, value) => sum + value, 0); const totalProfit = totalRealized + totalDividend;'
  );
}

v6 = v6.replace(
  '<p className="mt-1 text-[10px] text-slate-600">net after selling costs</p></div></div><div className={card}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Investment Accounts</h2>',
  '<p className="mt-1 text-[10px] text-slate-600">net after selling costs</p></div><div className={card}><p className="text-[10px] uppercase tracking-widest text-slate-500">Dividend Income</p><p className="mt-2 text-xl font-bold text-emerald-300">{money(totalDividend)}</p><p className="mt-1 text-[10px] text-slate-600">cash income received</p></div><div className={card}><p className="text-[10px] uppercase tracking-widest text-slate-500">Total Profit</p><p className={\`mt-2 text-xl font-bold \${totalProfit>=0?"text-emerald-300":"text-red-300"}\`}>{money(totalProfit)}</p><p className="mt-1 text-[10px] text-slate-600">realized + dividend</p></div></div><div className={card}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Investment Accounts</h2>'
);

write(v6Path, v6);
console.log("Final investment enhancements applied.");
