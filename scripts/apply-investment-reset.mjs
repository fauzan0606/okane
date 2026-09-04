import fs from "node:fs";

const apiPath = "app/api/investments/v2/route.ts";
const uiPath = "modules/investment/components/InvestmentDashboardV6.tsx";

let api = fs.readFileSync(apiPath, "utf8");
let ui = fs.readFileSync(uiPath, "utf8");

const apiAnchor = '    if (action === "account.create") {';
const apiBlock = `    if (action === "investment.reset") {
      const confirmation = String(body.confirmation || "");
      if (confirmation !== "RESET INVESTMENT") return NextResponse.json({ error: "Confirmation text is required." }, { status: 400 });
      const result = await prisma.$transaction(async tx => {
        const accountIds = (await tx.investmentAccount.findMany({ select: { id: true } })).map(x => x.id);
        await tx.investmentCashMovement.deleteMany({ where: {} });
        await tx.investmentTransaction.deleteMany({ where: {} });
        await tx.investmentHolding.deleteMany({ where: {} });
        await tx.investmentCashAccount.deleteMany({ where: {} });
        await tx.investmentAccount.deleteMany({ where: {} });
        await tx.investmentFeeRule.deleteMany({ where: {} });
        await tx.investmentProvider.deleteMany({ where: {} });
        await tx.investmentAsset.deleteMany({ where: {} });
        return { accountsDeleted: accountIds.length };
      });
      return NextResponse.json(serialize({ ok: true, ...result }));
    }

`;
if (!api.includes('if (action === "investment.reset")')) {
  if (!api.includes(apiAnchor)) throw new Error("Investment API anchor not found.");
  api = api.replace(apiAnchor, apiBlock + apiAnchor);
}

const fnAnchor = '  async function accountAction(action: "account.close" | "account.delete", account: Account) { if (!window.confirm(`${action.endsWith("close") ? "Close" : "Delete"} ${account.provider.name}?`)) return; const ok = await run({ action, accountId: account.id }, action.endsWith("close") ? "Account closed." : "Account deleted."); if (ok) setAccountId(""); }';
const fnBlock = `${fnAnchor}\\n  async function resetInvestmentData() {\\n    const first = window.confirm("Reset ALL Investment data? This will remove all investment accounts, transactions, holdings, RDN accounts, assets and broker settings. Wallets and normal transactions will NOT be affected.");\\n    if (!first) return;\\n    const typed = window.prompt("Type RESET INVESTMENT to confirm.");\\n    if (typed !== "RESET INVESTMENT") return;\\n    setBusy(true); setMessage("");\\n    try {\\n      await postV2({ action: "investment.reset", confirmation: typed });\\n      setAccountId("");\\n      setLedger(null);\\n      setSelectedAssetId("");\\n      setClosedAssetId("");\\n      await reload();\\n      setMessage("Investment data reset successfully.");\\n    } catch (e) {\\n      setMessage(e instanceof Error ? e.message : "Investment reset failed.");\\n    } finally {\\n      setBusy(false);\\n    }\\n  }`;
if (!ui.includes('async function resetInvestmentData()')) {
  if (!ui.includes(fnAnchor)) throw new Error("Investment account action anchor not found.");
  ui = ui.replace(fnAnchor, fnBlock);
}

const headerAnchor = '<button type="button" onClick={()=>openAccountEditor()} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add account</button></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">';
const headerReplacement = '<div className="flex gap-2"><button type="button" onClick={()=>openAccountEditor()} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add account</button><button type="button" onClick={()=>void resetInvestmentData()} disabled={busy} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Reset Investment</button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">';
if (!ui.includes('>Reset Investment</button>')) {
  if (!ui.includes(headerAnchor)) throw new Error("Investment account list header anchor not found.");
  ui = ui.replace(headerAnchor, headerReplacement);
}

if (!ui.includes('const [openPositionsOpen, setOpenPositionsOpen]')) {
  const historyStateRegex = /const\s+\[historyOpen,\s*setHistoryOpen\]\s*=\s*useState\(false\);/;
  const historyStateMatch = ui.match(historyStateRegex);
  if (!historyStateMatch) throw new Error("Transaction collapse state not found.");
  ui = ui.replace(historyStateMatch[0], historyStateMatch[0] + ' const [openPositionsOpen, setOpenPositionsOpen] = useState(false); const [closedTransactionsOpen, setClosedTransactionsOpen] = useState(false);');
}

const openHeaderAnchor = '<div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.02] p-3 text-xs text-slate-500">OPEN POSITIONS · {selectedOpenRows.length}</div>{selectedOpenRows.length?';
const openHeaderReplacement = '<button type="button" onClick={()=>setOpenPositionsOpen(v=>!v)} className="flex w-full items-center justify-between rounded-xl border border-emerald-400/10 bg-emerald-400/[.02] p-3 text-left text-xs text-slate-400 hover:bg-emerald-400/[.04]"><span>OPEN POSITIONS · {selectedOpenRows.length}</span><span className="text-slate-500">{openPositionsOpen?"Collapse ↑":"Expand ↓"}</span></button>{openPositionsOpen && (selectedOpenRows.length?';
if (!ui.includes('OPEN POSITIONS · {selectedOpenRows.length}</span>')) {
  if (!ui.includes(openHeaderAnchor)) throw new Error("Open positions header anchor not found.");
  ui = ui.replace(openHeaderAnchor, openHeaderReplacement);
}

const openContentEndAnchor = '<div className="p-8 text-center text-xs text-slate-600">Tidak ada open position.</div>}<div className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.02]';
const openContentEndReplacement = '<div className="p-8 text-center text-xs text-slate-600">Tidak ada open position.</div>)}<div className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.02]';
if (ui.includes('OPEN POSITIONS · {selectedOpenRows.length}</span>')) {
  if (!ui.includes(openContentEndReplacement) && ui.includes(openContentEndAnchor)) ui = ui.replace(openContentEndAnchor, openContentEndReplacement);
}

const selectedClosedAnchor = 'const selectedOpenRows = selectedAssetId ? openRows.filter(r => r.asset.id === selectedAssetId) : openRows; const selectedClosed = closedAssetId ? closedSales.filter(x => x.lot.asset.id === closedAssetId) : closedSales; const selectedSummary = assetSummaries.find(a => a.asset.id === sellAllAssetId) ?? null;';
const selectedClosedReplacement = 'const selectedOpenRows = selectedAssetId ? openRows.filter(r => r.asset.id === selectedAssetId) : openRows; const selectedClosed = closedAssetId ? closedSales.filter(x => x.lot.asset.id === closedAssetId) : closedSales; const closedSummary = useMemo(() => { const groups = new Map<string, { asset: Asset; soldQuantity: number; buyCost: number; sellValue: number; netPnl: number }>(); for (const { lot, sale } of selectedClosed) { const qty = Number(sale.quantity); const buyCost = Number(lot.totalCost) * qty / Math.max(Number(lot.quantity), 1); const sellValue = qty * Number(sale.price); const netPnl = Number(sale.realized); const key = lot.asset.id; const current = groups.get(key) ?? { asset: lot.asset, soldQuantity: 0, buyCost: 0, sellValue: 0, netPnl: 0 }; current.soldQuantity += qty; current.buyCost += buyCost; current.sellValue += sellValue; current.netPnl += netPnl; groups.set(key, current); } return [...groups.values()].map(x => ({ ...x, avgBuy: x.soldQuantity ? x.buyCost / x.soldQuantity : 0, avgSell: x.soldQuantity ? x.sellValue / x.soldQuantity : 0, pnlPct: x.buyCost ? (x.netPnl / x.buyCost) * 100 : 0 })).sort((a, b) => b.netPnl - a.netPnl); }, [selectedClosed]); const selectedSummary = assetSummaries.find(a => a.asset.id === sellAllAssetId) ?? null;';
if (!ui.includes('const closedSummary = useMemo')) {
  if (!ui.includes(selectedClosedAnchor)) throw new Error("Closed transaction summary anchor not found.");
  ui = ui.replace(selectedClosedAnchor, selectedClosedReplacement);
}

const legacyClosedHeader = '<button type="button" onClick={()=>setClosedTransactionsOpen(v=>!v)} className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.02] p-3 text-left hover:bg-white/[.03]"><span className="text-xs text-slate-500">CLOSED TRANSACTIONS · {selectedClosed.length}</span><span className="text-xs text-slate-500">{closedTransactionsOpen?"Collapse ↑":"Expand ↓"}</span></button>{closedTransactionsOpen && <div className="mt-2 flex justify-end"><select aria-label="Filter closed transactions by asset" className="w-full rounded-lg border border-white/10 bg-[#101923] px-3 py-2 text-xs text-slate-300 outline-none sm:w-auto" value={closedAssetId} onChange={e=>setClosedAssetId(e.target.value)}><option value="">All Assets</option>{closedAssets.map(asset=><option key={asset.id} value={asset.id}>{asset.symbol || asset.name}</option>)}</select></div>}{closedTransactionsOpen && selectedClosed.length>0&&';

const collapsedClosedHeader = '<div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-3"><div className="flex min-w-0 items-center gap-3"><span className="shrink-0 text-xs text-slate-500">CLOSED TRANSACTIONS · {selectedClosed.length}</span><select aria-label="Filter closed transactions by asset" className="w-full max-w-[220px] rounded-lg border border-white/10 bg-[#101923] px-3 py-2 text-xs text-slate-300 outline-none" value={closedAssetId} onChange={e=>setClosedAssetId(e.target.value)}><option value="">All Assets</option>{closedAssets.slice().sort((a,b)=>String(a.symbol || a.name).localeCompare(String(b.symbol || b.name),"id",{sensitivity:"base"})).map(asset=><option key={asset.id} value={asset.id}>{asset.symbol || asset.name}</option>)}</select></div><button type="button" onClick={()=>setClosedTransactionsOpen(v=>!v)} className="shrink-0 text-xs text-slate-500 hover:text-slate-300">{closedTransactionsOpen?"Collapse ↑":"Expand ↓"}</button></div>{closedTransactionsOpen && <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[.015] p-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED SUMMARY</div>{closedSummary.length>0?<table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Sold Qty</th><th>Avg Buy</th><th>Avg Sell</th><th>Net P/L</th><th>P/L %</th></tr></thead><tbody className="divide-y divide-white/5">{closedSummary.map(s=><tr key={s.asset.id}><td className="px-3 py-3 font-semibold text-white">{s.asset.symbol||s.asset.name}</td><td>{nf(s.soldQuantity/unitsPerLot(s.asset),0)} lot</td><td>{money(s.avgBuy,selected.currency.code)}</td><td>{money(s.avgSell,selected.currency.code)}</td><td className={s.netPnl>=0?"text-emerald-300":"text-red-300"}>{money(s.netPnl,selected.currency.code)}</td><td className={s.pnlPct>=0?"text-emerald-300":"text-red-300"}>{nf(s.pnlPct,2)}%</td></tr>)}</tbody></table>:<div className="p-6 text-center text-xs text-slate-600">Tidak ada closed transaction.</div>}</div>}{closedTransactionsOpen && selectedClosed.length>0&&';

if (!ui.includes('CLOSED SUMMARY')) {
  if (ui.includes(legacyClosedHeader)) {
    ui = ui.replace(legacyClosedHeader, collapsedClosedHeader);
  } else {
    throw new Error("Closed transactions header anchor not found.");
  }
}

fs.writeFileSync(apiPath, api);
fs.writeFileSync(uiPath, ui);
console.log("Applied Investment reset and closed transaction summary.");
