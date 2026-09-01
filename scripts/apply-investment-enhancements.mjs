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
const v4Path = "app/api/investments/v4/route.ts";
const overviewRoutePath = "app/api/investments/route.ts";

for (const file of [v6Path, v3Path, v2Path, v4Path, overviewRoutePath]) backup(file);

// ---------------------------------------------------------------------------
// Backend: permit SELL at zero, but keep BUY strictly positive.
// ---------------------------------------------------------------------------
let v3 = read(v3Path);
v3 = replaceOnce(
  v3,
  'const unitPrice = positive(input.unitPrice, "Unit price");',
  'const unitPrice = input.transactionType === "SELL"\n    ? (Number.isFinite(input.unitPrice) && input.unitPrice >= 0 ? new D(input.unitPrice) : (() => { throw new Error("Unit price cannot be negative."); })())\n    : positive(input.unitPrice, "Unit price");',
  "service-v3 unit price validation",
);
write(v3Path, v3);

let v4 = read(v4Path);
v4 = replaceOnce(
  v4,
  'if (!Number.isFinite(unitPrice) || unitPrice <= 0) return NextResponse.json({ error: "Sell price must be greater than zero." }, { status: 400 });',
  'if (!Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ error: "Sell price cannot be negative." }, { status: 400 });',
  "service-v4 sellAll price validation",
);
write(v4Path, v4);

// ---------------------------------------------------------------------------
// Backend: expose Dividend creation on the same v2 endpoint used by V6.
// ---------------------------------------------------------------------------
let v2 = read(v2Path);
v2 = replaceOnce(
  v2,
  'import { createInvestmentTransactionV3, getInvestmentAccountLedger, importInvestmentWorkbook, refreshInvestmentStockPrices, setInvestmentCashBalance } from "@/modules/investment/service-v3";',
  'import { createInvestmentTransactionV3, getInvestmentAccountLedger, importInvestmentWorkbook, refreshInvestmentStockPrices, setInvestmentCashBalance } from "@/modules/investment/service-v3";\nimport { recordInvestmentIncome } from "@/modules/investment/service";',
  "v2 route dividend import",
);
v2 = replaceOnce(
  v2,
  'if (action === "transaction.create") {',
  'if (action === "income.create") {\n      const type = String(body.type || "DIVIDEND");\n      if (type !== "DIVIDEND") return NextResponse.json({ error: "Only dividend income is supported here." }, { status: 400 });\n      return NextResponse.json(serialize(await recordInvestmentIncome({ accountId: String(body.accountId), assetId: String(body.assetId), type: InvestmentTransactionType.DIVIDEND, amount: Number(body.amount), date: new Date(String(body.date)), destinationCashAccountId: body.destinationCashAccountId ? String(body.destinationCashAccountId) : undefined, destinationWalletId: body.destinationWalletId ? String(body.destinationWalletId) : undefined, note: body.note ? String(body.note) : undefined })));\n    }\n\n    if (action === "transaction.create") {',
  "v2 route dividend action",
);
write(v2Path, v2);

// ---------------------------------------------------------------------------
// Backend: return dividend income and total profit in the overview summary.
// ---------------------------------------------------------------------------
let overviewRoute = read(overviewRoutePath);
overviewRoute = replaceOnce(
  overviewRoute,
  'const currencyRows = [...byCurrency.entries()].map(([code, row]) => ({ code, invested: row.value, costBasis: row.cost, cash: row.cash, total: row.value.plus(row.cash), unrealized: row.value.minus(row.cost) }));',
  'const currencyRows = [...byCurrency.entries()].map(([code, row]) => ({ code, invested: row.value, costBasis: row.cost, cash: row.cash, total: row.value.plus(row.cash), unrealized: row.value.minus(row.cost) }));\n    const dividendRows = await prisma.investmentTransaction.aggregate({ where: { transactionType: InvestmentTransactionType.DIVIDEND, currencyId: primaryCurrencyIdFallback(currencyRows) }, _sum: { netCashAmount: true } }).catch(() => ({ _sum: { netCashAmount: null } }));',
  "overview dividend aggregate",
);
// The prior replacement needs a concrete currency expression; make the route independent of helper state.
overviewRoute = overviewRoute.replace(
  'const dividendRows = await prisma.investmentTransaction.aggregate({ where: { transactionType: InvestmentTransactionType.DIVIDEND, currencyId: primaryCurrencyIdFallback(currencyRows) }, _sum: { netCashAmount: true } }).catch(() => ({ _sum: { netCashAmount: null } }));',
  'const primaryCode = currencyRows.find(r => r.code === "IDR")?.code ?? currencyRows[0]?.code ?? "IDR";\n    const primaryCurrency = currencyRows.find(r => r.code === primaryCode);\n    const dividendRows = primaryCurrency ? await prisma.investmentTransaction.aggregate({ where: { transactionType: InvestmentTransactionType.DIVIDEND, currency: { code: primaryCode } }, _sum: { netCashAmount: true } }) : { _sum: { netCashAmount: null } };\n    const dividendIncome = dividendRows._sum.netCashAmount ?? new Prisma.Decimal(0);',
);
const oldSafe = 'const primary = currencyRows.find(r => r.code === "IDR") ?? currencyRows[0] ?? { code: "IDR", invested: new Prisma.Decimal(0), costBasis: new Prisma.Decimal(0), cash: new Prisma.Decimal(0), total: new Prisma.Decimal(0), unrealized: new Prisma.Decimal(0) };\n    const safeSummary = { totalValue: primary.invested, totalCost: primary.costBasis, totalCash: primary.cash, totalInvestmentValue: primary.total, unrealized: primary.unrealized, returnPct: primary.costBasis.isZero() ? new Prisma.Decimal(0) : primary.unrealized.div(primary.costBasis).mul(100), primaryCurrency: primary.code, byCurrency: currencyRows };';
const newSafe = 'const primary = currencyRows.find(r => r.code === "IDR") ?? currencyRows[0] ?? { code: "IDR", invested: new Prisma.Decimal(0), costBasis: new Prisma.Decimal(0), cash: new Prisma.Decimal(0), total: new Prisma.Decimal(0), unrealized: new Prisma.Decimal(0) };\n    const dividendIncomeForPrimary = primaryCode === primary.code ? dividendIncome : new Prisma.Decimal(0);\n    const totalProfit = primary.unrealized.plus(dividendIncomeForPrimary);\n    const safeSummary = { totalValue: primary.invested, totalCost: primary.costBasis, totalCash: primary.cash, totalInvestmentValue: primary.total, unrealized: primary.unrealized, realized: new Prisma.Decimal(0), dividendIncome: dividendIncomeForPrimary, totalProfit, returnPct: primary.costBasis.isZero() ? new Prisma.Decimal(0) : primary.unrealized.div(primary.costBasis).mul(100), primaryCurrency: primary.code, byCurrency: currencyRows };';
if (!overviewRoute.includes(oldSafe)) throw new Error("Overview safe summary anchor not found.");
overviewRoute = overviewRoute.replace(oldSafe, newSafe);
write(overviewRoutePath, overviewRoute);

// ---------------------------------------------------------------------------
// Frontend V6: preference, zero-price SELL, dividend, and cards/table view.
// ---------------------------------------------------------------------------
let v6 = read(v6Path);

v6 = replaceOnce(
  v6,
  'type Overview = { currencies: Currency[]; providers: Provider[]; accounts: Account[]; assets: Asset[]; holdings: Holding[]; cashAccounts: Cash[]; summary: { totalValue: string | number; totalCash: string | number; totalInvestmentValue: string | number; unrealized: string | number; returnPct: string | number } };',
  'type Overview = { currencies: Currency[]; providers: Provider[]; accounts: Account[]; assets: Asset[]; holdings: Holding[]; cashAccounts: Cash[]; summary: { totalValue: string | number; totalCash: string | number; totalInvestmentValue: string | number; unrealized: string | number; realized?: string | number; dividendIncome?: string | number; totalProfit?: string | number; returnPct: string | number } };',
  "V6 Overview type",
);

v6 = replaceOnce(
  v6,
  'const [importing, setImporting] = useState(false);',
  'const [importing, setImporting] = useState(false); const [assetSummaryView, setAssetSummaryView] = useState<"cards" | "table">("cards"); const [showDividend, setShowDividend] = useState(false); const [dividendAssetId, setDividendAssetId] = useState(""); const [dividendAmount, setDividendAmount] = useState(""); const [dividendDate, setDividendDate] = useState(today()); const [dividendDestination, setDividendDestination] = useState("");',
  "V6 enhancement state",
);

v6 = replaceOnce(
  v6,
  'useEffect(() => { reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments.")); fetch("/api/investments/cash-transfer", { cache: "no-store" }).then(r => r.json()).then(j => setWallets(j.wallets ?? [])).catch(() => undefined); }, []);',
  'useEffect(() => { reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments.")); fetch("/api/investments/cash-transfer", { cache: "no-store" }).then(r => r.json()).then(j => setWallets(j.wallets ?? [])).catch(() => undefined); const savedView = window.localStorage.getItem("okane.assetSummaryView"); if (savedView === "cards" || savedView === "table") setAssetSummaryView(savedView); }, []);',
  "V6 initial preference load",
);

v6 = replaceOnce(
  v6,
  'const canSubmit = !!trade.assetQuery.trim() && qty > 0 && price > 0 && !!trade.fundingCashAccountId && (trade.type === "BUY" || (!!sellLot && quantityValid));',
  'const canSubmit = !!trade.assetQuery.trim() && qty > 0 && (trade.type === "SELL" ? price >= 0 : price > 0) && !!trade.fundingCashAccountId && (trade.type === "BUY" || (!!sellLot && quantityValid));',
  "TradeModal zero-price validation",
);
v6 = replaceOnce(
  v6,
  'type="number" min="0.01" step="0.01" value={trade.unitPrice}',
  'type="number" min={trade.type === "SELL" ? "0" : "0.01"} step="0.01" value={trade.unitPrice}',
  "TradeModal sell price input",
);
v6 = replaceOnce(
  v6,
  'if (!asset || !trade.quantity || !trade.unitPrice || !trade.fundingCashAccountId) return setMessage("Lengkapi asset, quantity, harga dan RDN.");',
  'if (!asset || !trade.quantity || trade.unitPrice === "" || (trade.type === "BUY" && !trade.unitPrice) || !trade.fundingCashAccountId) return setMessage("Lengkapi asset, quantity, harga dan RDN.");',
  "submitTrade zero-price validation",
);

v6 = replaceOnce(
  v6,
  '}).sort((a, b) => b.marketValue - a.marketValue); }, [ledger, selected]);',
  '}).sort((a, b) => (a.asset.symbol || a.asset.name).localeCompare(b.asset.symbol || b.asset.name, "id", { sensitivity: "base" })); }, [ledger, selected]);',
  "Asset Summary alphabetical sort",
);

// Add a Dividend button next to New transaction.
v6 = replaceOnce(
  v6,
  '<button type="button" onClick={()=>openTrade("BUY")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ New transaction</button>',
  '<div className="flex gap-2"><button type="button" onClick={()=>{setDividendAssetId(selectedAssetId || assetSummaries[0]?.asset.id || "");setDividendAmount("");setDividendDate(today());setDividendDestination(selected.cashAccount?.id || "");setShowDividend(true);}} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-300">+ Dividend</button><button type="button" onClick={()=>openTrade("BUY")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ New transaction</button></div>',
  "Dividend button",
);

// Add Cards/Table selector while preserving the existing card markup.
v6 = replaceOnce(
  v6,
  '<div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2><p className="text-xs text-slate-600">Satu baris = satu asset, gabungan seluruh lot yang masih dimiliki.</p></div>',
  '<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2><p className="text-xs text-slate-600">Satu baris = satu asset, gabungan seluruh lot yang masih dimiliki.</p></div><div className="flex rounded-lg border border-white/10 bg-white/[.02] p-1"><button type="button" onClick={()=>{setAssetSummaryView("cards");window.localStorage.setItem("okane.assetSummaryView","cards");}} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${assetSummaryView === "cards" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>▦ Cards</button><button type="button" onClick={()=>{setAssetSummaryView("table");window.localStorage.setItem("okane.assetSummaryView","table");}} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${assetSummaryView === "table" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>☷ Table</button></div>',
  "Asset Summary view selector",
);

v6 = replaceOnce(
  v6,
  '<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{assetSummaries.map(s =>',
  '{assetSummaryView === "cards" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{assetSummaries.map(s =>',
  "Asset Summary cards wrapper",
);

const beforeEmpty = '</div>:<div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-600">Belum ada open position.</div>}</div>';
const tableInsert = '</div>}{assetSummaryView === "table" && <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Value</th><th>Min. Sell</th><th>P/L</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{assetSummaries.map(s => <tr key={s.asset.id} className={selectedAssetId===s.asset.id?"bg-emerald-400/[.03]":""} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><td className="px-3 py-3"><p className="font-semibold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></td><td>{nf(s.quantity/unitsPerLot(s.asset),0)} lot</td><td>{money(s.avgCost,selected.currency.code)}</td><td>{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</td><td>{money(s.marketValue,selected.currency.code)}</td><td className="text-amber-300">{money(s.minSell,selected.currency.code)}</td><td className={s.pnl>=0?"text-emerald-300":"text-red-300"}>{money(s.pnl,selected.currency.code)}</td><td className="text-right pr-3"><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="rounded-lg border border-emerald-400/20 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">Sell All</button></td></tr>)}</tbody></table></div>:<div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-600">Belum ada open position.</div>}</div>';
if (!v6.includes(beforeEmpty)) throw new Error("Asset Summary empty-state anchor not found after card wrapper change.");
v6 = v6.replace(beforeEmpty, tableInsert);

// Add a Total Profit card only if the current baseline still uses the 4-card summary.
const overviewGrid = '<div className="grid gap-3 md:grid-cols-4">';
if (v6.includes(overviewGrid) && !v6.includes('>Total Profit</p>')) {
  v6 = v6.replace(
    overviewGrid,
    '<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">',
  );
  const oldUnrealizedMapEnd = '</div></div><div className={card}><div className="mb-4 flex items-center justify-between">';
  if (v6.includes(oldUnrealizedMapEnd)) {
    v6 = v6.replace(
      oldUnrealizedMapEnd,
      '</div>)}<div className={card}><p className="text-[10px] uppercase tracking-widest text-slate-500">Realized P/L</p><p className={`mt-2 text-xl font-bold ${Number(data.summary.realized ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(data.summary.realized ?? 0)}</p><p className="mt-1 text-[10px] text-slate-600">closed positions</p></div><div className={card}><p className="text-[10px] uppercase tracking-widest text-slate-500">Dividend Income</p><p className="mt-2 text-xl font-bold text-emerald-300">{money(data.summary.dividendIncome ?? 0)}</p><p className="mt-1 text-[10px] text-slate-600">cash income</p></div><div className={card}><p className="text-[10px] uppercase tracking-widest text-slate-500">Total Profit</p><p className={`mt-2 text-xl font-bold ${Number(data.summary.totalProfit ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(data.summary.totalProfit ?? 0)}</p><p className="mt-1 text-[10px] text-slate-600">unrealized + realized + dividend</p></div><div className={card}><div className="mb-4 flex items-center justify-between">',
    );
  }
}

// Dividend handler.
v6 = replaceOnce(
  v6,
  'async function saveAccount(e: FormEvent) {',
  'async function saveDividend() { if (!selected || !dividendAssetId || !dividendAmount || !dividendDestination) return; const value = Number(dividendAmount); if (!Number.isFinite(value) || value <= 0) return setMessage("Dividend amount must be greater than zero."); const ok = await run({ action: "income.create", accountId: selected.id, assetId: dividendAssetId, type: "DIVIDEND", amount: value, date: new Date(dividendDate).toISOString(), destinationCashAccountId: dividendDestination }, "Dividend recorded."); if (ok) { setShowDividend(false); setDividendAmount(""); } }\n  async function saveAccount(e: FormEvent) {',
  "Dividend handler",
);

// Dividend modal.
v6 = replaceOnce(
  v6,
  '<SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} />',
  '<SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} />{selected&&showDividend&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={e=>{e.preventDefault();void saveDividend();}} className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">INVESTMENT INCOME</p><h2 className="mt-1 text-2xl font-bold text-white">Record Dividend</h2><p className="mt-1 text-xs text-slate-500">Catat dividend dan masukkan ke RDN.</p></div><button type="button" onClick={()=>setShowDividend(false)} className="text-2xl text-slate-500">×</button></div><div className="mt-5 space-y-4"><label className="block text-xs text-slate-500">Asset<select className={`${select} mt-2`} value={dividendAssetId} onChange={e=>setDividendAssetId(e.target.value)}><option value="">Select asset</option>{assetSummaries.map(s=><option key={s.asset.id} value={s.asset.id}>{s.asset.symbol||s.asset.name}</option>)}</select></label><label className="block text-xs text-slate-500">Dividend amount<input className={`${input} mt-2`} type="number" min="0.01" step="0.01" value={dividendAmount} onChange={e=>setDividendAmount(e.target.value)} placeholder="100000" /></label><label className="block text-xs text-slate-500">Date<input className={`${input} mt-2`} type="date" value={dividendDate} onChange={e=>setDividendDate(e.target.value)} /></label><label className="block text-xs text-slate-500">Receive to RDN<select className={`${select} mt-2`} value={dividendDestination} onChange={e=>setDividendDestination(e.target.value)}><option value="">Select RDN</option>{selected.cashAccount&&<option value={selected.cashAccount.id}>{selected.name} · {money(selected.cashAccount.balance,selected.currency.code)}</option>}</select></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setShowDividend(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Cancel</button><button type="submit" disabled={busy||!dividendAssetId||!dividendAmount||!dividendDestination} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy?"Saving…":"Record dividend"}</button></div></form></div>}',
  "Dividend modal",
);

write(v6Path, v6);

console.log("Investment enhancements applied successfully.");
console.log("Modified:", v6Path, v3Path, v2Path, v4Path, overviewRoutePath);
console.log("Backups created with .backup-before-investment-enhancements suffix.");
