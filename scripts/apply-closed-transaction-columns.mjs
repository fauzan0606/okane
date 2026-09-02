import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "modules/investment/components/InvestmentDashboardV6.tsx");
let s = fs.readFileSync(file, "utf8");

const anchor = '<div className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.02] p-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-500">CLOSED TRANSACTIONS · {selectedClosed.length}</span>';
const start = s.indexOf(anchor);
if (start < 0) throw new Error("Closed transactions filter anchor not found.");

const tableStart = s.indexOf('{selectedClosed.length>0&&<div className="mt-2 overflow-x-auto">', start);
if (tableStart < 0) throw new Error("Closed transactions table anchor not found.");

const nextSection = s.indexOf('</div>\n      <div className={card}><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-white">Dividend Detail</h2>', tableStart);
if (nextSection < 0) throw new Error("Dividend Detail section anchor not found.");

const replacement = `{selectedClosed.length>0&&<div className="mt-2 overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Tanggal Jual</th><th>Kode Saham</th><th>Lot Terjual</th><th>Avg Buy</th><th>Harga Jual</th><th>Holding Period</th><th>Net P/L</th><th>P/L %</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{selectedClosed.map(x=>{const buyCost=Number(x.lot.totalCost)*Number(x.sale.quantity)/Math.max(Number(x.lot.quantity),1); const realized=Number(x.sale.realized); const pnlPct=buyCost!==0?(realized/buyCost)*100:0; const holdingDays=Math.max(0,Math.floor((new Date(x.sale.date).getTime()-new Date(x.lot.transactionDate).getTime())/86400000)); return <tr key={x.sale.id}><td className="px-3 py-3 whitespace-nowrap text-slate-400">{new Date(x.sale.date).toLocaleDateString("id-ID")}</td><td className="font-semibold text-white">{x.lot.asset.symbol||x.lot.asset.name}</td><td>{nf(Number(x.sale.quantity)/unitsPerLot(x.lot.asset),0)} lot</td><td>{money(x.lot.unitPrice,selected.currency.code)}</td><td>{money(x.sale.price,selected.currency.code)}</td><td className="whitespace-nowrap">{holdingDays} hari</td><td className={realized>=0?"text-emerald-300":"text-red-300"}>{money(realized,selected.currency.code)}</td><td className={pnlPct>=0?"text-emerald-300":"text-red-300"}>{nf(pnlPct,2)}%</td><td className="text-right whitespace-nowrap"><button type="button" onClick={()=>{const d=new Date(x.sale.date).toISOString().slice(0,10);setClosedEdit({id:x.sale.id,asset:x.lot.asset,quantity:Number(x.sale.quantity),date:d,price:Number(x.sale.price)});setClosedEditDate(d);setClosedEditPrice(String(x.sale.price));setClosedEditTax("0");setClosedEditOther("0");}} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-300">Edit</button><button type="button" onClick={()=>deleteClosedTransaction(x.sale.id)} className="ml-2 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300">Delete</button></td></tr>;})}</tbody></table></div>}`;

s = s.slice(0, tableStart) + replacement + s.slice(nextSection);
fs.writeFileSync(file, s);
console.log("Closed transaction columns aligned.");
