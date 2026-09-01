import fs from "node:fs";
import path from "node:path";
const p = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(p, "utf8");
function must(old, next, label) {
  if (!s.includes(old)) throw new Error(`Missing anchor: ${label}`);
  s = s.replace(old, next);
}

// Sell All must accept exactly zero.
must('type="number" min="0.01" step="0.01" value={price}', 'type="number" min="0" step="0.01" value={price}', 'Sell All price minimum');

// Derive dividend and total profit from the already loaded account ledger data.
if (!s.includes('const totalDividend = Object.values(dividendByAccount)')) {
  must(
    'const totalRealized = Object.values(realizedByAccount).reduce(\n    (sum, value) => sum + value,\n    0\n  );',
    'const totalRealized = Object.values(realizedByAccount).reduce(\n    (sum, value) => sum + value,\n    0\n  );\n  const totalDividend = Object.values(dividendByAccount).reduce((sum, value) => sum + value, 0);\n  const totalProfit = totalRealized + totalDividend;',
    'profit totals'
  );
}

// Add Dividend Income and Total Profit cards immediately after Realized P/L.
if (!s.includes('>Dividend Income</p>')) {
  must(
    '<p className="mt-1 text-[10px] text-slate-600">net after selling costs</p>\n          </div>\n        </div><div className={card}><div className="mb-4 flex items-center justify-between">',
    '<p className="mt-1 text-[10px] text-slate-600">net after selling costs</p>\n          </div>\n          <div className={card}>\n            <p className="text-[10px] uppercase tracking-widest text-slate-500">Dividend Income</p>\n            <p className="mt-2 text-xl font-bold text-emerald-300">{money(totalDividend)}</p>\n            <p className="mt-1 text-[10px] text-slate-600">cash income received</p>\n          </div>\n          <div className={card}>\n            <p className="text-[10px] uppercase tracking-widest text-slate-500">Total Profit</p>\n            <p className={`mt-2 text-xl font-bold ${totalProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(totalProfit)}</p>\n            <p className="mt-1 text-[10px] text-slate-600">realized + dividend</p>\n          </div>\n        </div><div className={card}><div className="mb-4 flex items-center justify-between">',
    'overview profit cards'
  );
}

fs.writeFileSync(p, s);
console.log("final-ui-fixes-applied");
