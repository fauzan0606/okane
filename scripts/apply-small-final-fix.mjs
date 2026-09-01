import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(p, "utf8");
let changed = false;

// SELL ALL: allow exactly zero.
if (s.includes('type="number" min="0.01" step="0.01" value={price}')) {
  s = s.replace('type="number" min="0.01" step="0.01" value={price}', 'type="number" min="0" step="0.01" value={price}');
  changed = true;
}

// Overview totals: realized + dividend.
if (!s.includes('const totalDividend = Object.values(dividendByAccount)')) {
  const marker = '  const formattedPriceUpdate = lastPriceUpdate';
  const idx = s.indexOf(marker);
  if (idx < 0) throw new Error("Total-profit anchor not found");
  const totalStart = s.lastIndexOf('  const totalRealized =', idx);
  if (totalStart < 0) throw new Error("Realized-total anchor not found");
  s = s.slice(0, totalStart) + '  const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0);\n  const totalDividend = Object.values(dividendByAccount).reduce((sum, value) => sum + value, 0);\n  const totalProfit = totalRealized + totalDividend;\n' + s.slice(idx);
  changed = true;
}

// Add visible Dividend Income + Total Profit cards after the existing Realized P/L card.
if (!s.includes('>Dividend Income</p>')) {
  const old = '          <p className="mt-1 text-[10px] text-slate-600">net after selling costs</p>\n          </div>\n        </div>';
  const next = '          <p className="mt-1 text-[10px] text-slate-600">net after selling costs</p>\n          </div>\n          <div className={card}>\n            <p className="text-[10px] uppercase tracking-widest text-slate-500">Dividend Income</p>\n            <p className="mt-2 text-xl font-bold text-emerald-300">{money(totalDividend)}</p>\n            <p className="mt-1 text-[10px] text-slate-600">cash income received</p>\n          </div>\n          <div className={card}>\n            <p className="text-[10px] uppercase tracking-widest text-slate-500">Total Profit</p>\n            <p className={`mt-2 text-xl font-bold ${totalProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(totalProfit)}</p>\n            <p className="mt-1 text-[10px] text-slate-600">realized + dividend</p>\n          </div>\n        </div>';
  if (!s.includes(old)) throw new Error("Overview cards anchor not found");
  s = s.replace(old, next);
  changed = true;
}

fs.writeFileSync(p, s);
console.log(changed ? "small-final-fix: changed" : "small-final-fix: already complete");
