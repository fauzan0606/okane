import fs from "node:fs";
import path from "node:path";
const p = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(p, "utf8");
const old = '  const totalProfit = totalRealized + totalDividend;';
const next = '  const totalUnrealized = Number(data.summary.unrealized ?? 0) || 0;\n  const totalProfit = totalUnrealized + totalRealized + totalDividend;';
if (s.includes(old)) s = s.replace(old, next);
fs.writeFileSync(p, s);
console.log("total profit = unrealized + realized + dividend");
