import fs from "node:fs";
import path from "node:path";
const file = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(file, "utf8");
s = s.replaceAll(">Tanggal Jual<", ">Sell Date<").replaceAll(">Kode Saham<", ">Asset<").replaceAll(">Lot Terjual<", ">Sold Qty<").replaceAll(">Harga Jual<", ">Sell Price<").replaceAll(">hari</", ">days</");
fs.writeFileSync(file, s);
