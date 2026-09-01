import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(file, "utf8");
let changes = [];

function replaceRequired(regex, replacement, label) {
  if (!regex.test(s)) throw new Error(`Missing anchor: ${label}`);
  s = s.replace(regex, replacement);
  changes.push(label);
}

// Sell All: exact zero is valid.
if (/type="number" min="0\.01" step="0\.01" value=\{price\}/.test(s)) {
  replaceRequired(
    /type="number" min="0\.01" step="0\.01" value=\{price\}/,
    'type="number" min="0" step="0.01" value={price}',
    "Sell All accepts price 0",
  );
}

// Create summary values from dividend ledger data.
if (!/const totalDividend = Object\.values\(dividendByAccount\)/.test(s)) {
  replaceRequired(
    /const totalRealized = Object\.values\(realizedByAccount\)\.reduce\([\s\S]*?\n  \);/, 
    'const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0);\n  const totalDividend = Object.values(dividendByAccount).reduce((sum, value) => sum + value, 0);\n  const totalProfit = totalRealized + totalDividend;',
    "Dividend and Total Profit totals",
  );
}

// Add overview cards after Realized P/L.
if (!/Dividend Income/.test(s)) {
  replaceRequired(
    /(<p className="mt-1 text-\[10px\] text-slate-600">net after selling costs<\/p>\s*<\/div>\s*<\/div>)(<\/div><div className=\{card\}><div className="mb-4 flex items-center justify-between">)/,
    '$1<div className={card}><p className="text-[10px] uppercase tracking-widest text-slate-500">Dividend Income</p><p className="mt-2 text-xl font-bold text-emerald-300">{money(totalDividend)}</p><p className="mt-1 text-[10px] text-slate-600">cash income received</p></div><div className={card}><p className="text-[10px] uppercase tracking-widest text-slate-500">Total Profit</p><p className={`mt-2 text-xl font-bold ${totalProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(totalProfit)}</p><p className="mt-1 text-[10px] text-slate-600">realized + dividend</p></div>$2',
    "Overview Dividend Income and Total Profit cards",
  );
}

fs.writeFileSync(file, s);
fs.writeFileSync(path.join(process.cwd(), "investment-ui-fix-log.txt"), changes.join("\n") + "\n");
console.log(changes.join("\n"));
