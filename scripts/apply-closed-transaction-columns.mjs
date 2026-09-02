import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(file, "utf8");

const labels = [
  [">Tanggal Jual<", ">Sell Date<"],
  [">Kode Saham<", ">Asset<"],
  [">Lot Terjual<", ">Sold Qty<"],
  [">Harga Jual<", ">Sell Price<"],
  [">hari</", ">days</"],
];

for (const [from, to] of labels) s = s.replaceAll(from, to);

fs.writeFileSync(file, s);
console.log("Closed transaction labels normalized to English.");
