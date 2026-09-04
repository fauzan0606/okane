import fs from "node:fs";

const uiPath = "modules/investment/components/InvestmentDashboardV6.tsx";
let ui = fs.readFileSync(uiPath, "utf8");

if (!ui.includes("closedSummaryOpen, setClosedSummaryOpen")) {
  const stateRegex = /const\s+\[closedTransactionsOpen,\s*setClosedTransactionsOpen\]\s*=\s*useState\(false\);/;
  const match = ui.match(stateRegex);
  if (!match) throw new Error("Closed transaction collapse state not found.");
  ui = ui.replace(match[0], match[0] + ' const [closedSummaryOpen, setClosedSummaryOpen] = useState(true); const [closedDetailOpen, setClosedDetailOpen] = useState(true);');
}

const summaryStart = ui.indexOf('{closedTransactionsOpen && <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[.015] p-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED SUMMARY</div>');
const detailStart = ui.indexOf('{closedTransactionsOpen && selectedClosed.length>0&&', summaryStart);
if (summaryStart < 0) throw new Error("Closed summary block not found.");
if (detailStart < 0) throw new Error("Closed detail block not found.");

const summaryPrefix = '{closedTransactionsOpen && <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[.015] p-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED SUMMARY</div>';
const summaryPrefixNew = '{closedTransactionsOpen && <div className="mt-3 rounded-xl border border-white/10 bg-white/[.015] p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED SUMMARY</span><button type="button" onClick={()=>setClosedSummaryOpen(v=>!v)} className="text-xs text-slate-500 hover:text-slate-300">{closedSummaryOpen?"Collapse ↑":"Expand ↓"}</button></div>{closedSummaryOpen && <div className="overflow-x-auto">';

let summaryBlock = ui.slice(summaryStart, detailStart);
if (!summaryBlock.startsWith(summaryPrefix)) throw new Error("Closed summary prefix mismatch.");
summaryBlock = summaryBlock.replace(summaryPrefix, summaryPrefixNew);
if (!summaryBlock.endsWith('</div>}')) throw new Error("Closed summary end marker not found.");
summaryBlock = summaryBlock.slice(0, -7) + '</div></div>}';
ui = ui.slice(0, summaryStart) + summaryBlock + ui.slice(detailStart);

const newDetailStart = ui.indexOf('{closedTransactionsOpen && selectedClosed.length>0&&', summaryStart);
const detailEnd = ui.indexOf('</div>}</div>', newDetailStart);
if (newDetailStart < 0 || detailEnd < 0) throw new Error("Closed detail end marker not found.");
const detailEndExclusive = detailEnd + '</div>}'.length;
let detailBlock = ui.slice(newDetailStart, detailEndExclusive);
const detailPrefix = '{closedTransactionsOpen && selectedClosed.length>0&&<div className="mt-2 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">';
const detailPrefixNew = '{closedTransactionsOpen && selectedClosed.length>0&&<div className="mt-4 rounded-xl border border-white/10 bg-white/[.015] p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED DETAIL</span><button type="button" onClick={()=>setClosedDetailOpen(v=>!v)} className="text-xs text-slate-500 hover:text-slate-300">{closedDetailOpen?"Collapse ↑":"Expand ↓"}</button></div>{closedDetailOpen && <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">';
if (!detailBlock.startsWith(detailPrefix)) throw new Error("Closed detail prefix mismatch.");
detailBlock = detailBlock.replace(detailPrefix, detailPrefixNew);
if (!detailBlock.endsWith('</div>}')) throw new Error("Closed detail end marker not found.");
detailBlock = detailBlock.slice(0, -7) + '</div></div>}';
ui = ui.slice(0, newDetailStart) + detailBlock + ui.slice(detailEndExclusive);

fs.writeFileSync(uiPath, ui);
console.log("Applied separate collapse controls for closed summary and closed detail.");
