import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(p, "utf8");

const old = '<h2 className="mt-1 text-xl font-semibold text-white">{selected.name}</h2><p className="mt-1 text-xs text-slate-500">RDN {fee.rdnBankName || "—"} · {selected.currency.code}</p>';
const next = '<div className="flex flex-wrap items-center gap-3"><h2 className="mt-1 text-xl font-semibold text-white">{selected.name}</h2><span className="rounded-lg border border-emerald-400/20 bg-emerald-400/[.04] px-2.5 py-1 text-xs font-semibold text-emerald-300">RDN Balance · {money(selectedCash?.balance ?? 0, selected.currency.code)}</span></div><p className="mt-1 text-xs text-slate-500">RDN {fee.rdnBankName || "—"} · {selected.currency.code}</p>';

if (s.includes(old)) {
  s = s.replace(old, next);
  fs.writeFileSync(p, s);
  console.log("compact-rdn-balance: changed");
} else if (s.includes("RDN Balance · {money(selectedCash?.balance")) {
  console.log("compact-rdn-balance: already compact");
} else {
  throw new Error("Transaction account header anchor not found");
}
