import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const p = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
const restored = execFileSync("git", ["show", "c31118cc9af2c86e6ee12d4166f0dccf282d6348:modules/investment/components/InvestmentDashboardV6.tsx"], { encoding: "utf8" });
let s = restored;

// Fix the accidental literal escape sequences in the Dividend type declarations.
s = s.replace(" | null;\\ntype DividendRow", " | null;\ntype DividendRow").replace("};\\ntype DividendEdit", "};\ntype DividendEdit");

// Keep the existing small fixes idempotent.
if (s.includes('type="number" min="0.01" step="0.01" value={price}')) {
  s = s.replace('type="number" min="0.01" step="0.01" value={price}', 'type="number" min="0" step="0.01" value={price}');
}

if (!s.includes('const totalDividend = Object.values(dividendByAccount)')) {
  const marker = '  const formattedPriceUpdate = lastPriceUpdate';
  const idx = s.indexOf(marker);
  const totalStart = s.lastIndexOf('  const totalRealized =', idx);
  if (idx < 0 || totalStart < 0) throw new Error("Total-profit anchor not found");
  s = s.slice(0, totalStart) + '  const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0);\n  const totalDividend = Object.values(dividendByAccount).reduce((sum, value) => sum + value, 0);\n  const totalProfit = totalRealized + totalDividend;\n' + s.slice(idx);
}

fs.writeFileSync(p, s);
console.log("Restored and normalized InvestmentDashboardV6.tsx");
