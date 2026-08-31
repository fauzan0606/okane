from pathlib import Path

path = Path("modules/investment/components/InvestmentDashboardV6.tsx")
text = path.read_text()

if "function ClosedSellEditModal(" in text:
    print("Closed transaction UI already applied.")
    raise SystemExit(0)

trade_type = 'type Trade = { type: "BUY" | "SELL"; assetId: string; assetQuery: string; quantity: string; unitPrice: string; tax: string; other: string; date: string; sourceLotId: string; fundingCashAccountId: string };'
if trade_type not in text:
    raise SystemExit("Trade type anchor not found. No changes made.")
text = text.replace(trade_type, trade_type + '\ntype ClosedEdit = { id: string; asset: Asset; quantity: number; date: string; price: number } | null;', 1)

modal_anchor = "function SellAllModal("
modal = '''function ClosedSellEditModal({ open, edit, account, date, price, tax, other, setDate, setPrice, setTax, setOther, onClose, onSubmit, busy }: { open: boolean; edit: ClosedEdit; account: Account | null; date: string; price: string; tax: string; other: string; setDate: (v: string) => void; setPrice: (v: string) => void; setTax: (v: string) => void; setOther: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean }) {
  if (!open || !edit || !account) return null;
  const feePct = feeInfo(account).sellFeePct;
  const gross = edit.quantity * Number(price || 0);
  const fee = gross * feePct / 100;
  const net = gross - fee - Number(tax || 0) - Number(other || 0);
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-amber-300">Edit Closed Transaction</p><h2 className="mt-1 text-2xl font-bold text-white">{edit.asset.symbol || edit.asset.name}</h2><p className="mt-1 text-xs text-slate-500">{nf(edit.quantity / unitsPerLot(edit.asset), 0)} lot · quantity tetap</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-500">×</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-500">Sell date<input className={`${input} mt-2`} type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label className="text-xs text-slate-500">Sell price / share<input className={`${input} mt-2`} type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label><label className="text-xs text-slate-500">Tax<input className={`${input} mt-2`} type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></label><label className="text-xs text-slate-500">Other charges<input className={`${input} mt-2`} type="number" min="0" step="0.01" value={other} onChange={e => setOther(e.target.value)} /></label></div><div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-xl border border-white/10 p-3"><p className="text-[10px] text-slate-600">Gross</p><p className="mt-1 text-sm font-semibold text-white">{money(gross, account.currency.code)}</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-[10px] text-slate-600">Sell fee · {nf(feePct,3)}%</p><p className="mt-1 text-sm font-semibold text-white">{money(fee, account.currency.code)}</p></div><div className="rounded-xl border border-white/10 bg-white/[.02] p-3"><p className="text-[10px] text-slate-600">Net proceeds</p><p className="mt-1 text-sm font-semibold text-white">{money(net, account.currency.code)}</p></div></div><p className="mt-3 text-[10px] text-slate-600">Quantity/lot allocation tidak diubah. Untuk koreksi jumlah, gunakan Delete lalu lakukan SELL/Split kembali.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancel</button><button type="button" onClick={onSubmit} disabled={busy || Number(price) <= 0} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy ? "Saving…" : "Save changes"}</button></div></div></div>;
}

'''
pos = text.find(modal_anchor)
if pos < 0:
    raise SystemExit("SellAllModal anchor not found. No changes made.")
text = text[:pos] + modal + text[pos:]

state_marker = 'const [importing, setImporting] = useState(false);'
if state_marker not in text:
    raise SystemExit("Importing state anchor not found. No changes made.")
text = text.replace(state_marker, state_marker + ' const [closedEdit, setClosedEdit] = useState<ClosedEdit>(null); const [closedEditDate, setClosedEditDate] = useState(today()); const [closedEditPrice, setClosedEditPrice] = useState(""); const [closedEditTax, setClosedEditTax] = useState("0"); const [closedEditOther, setClosedEditOther] = useState("0");', 1)

handler_anchor = 'async function sellAll() {'
handlers = '''async function deleteClosedTransaction(id: string) {
    if (!window.confirm("Hapus transaksi SELL ini? Quantity akan kembali ke posisi dan dana hasil penjualan akan dibalik.")) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/investments/v2/closed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", transactionId: id }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Closed transaction delete failed.");
      await reload();
      if (accountId) await loadLedger(accountId);
      setMessage("Closed transaction deleted.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Closed transaction delete failed."); }
    finally { setBusy(false); }
  }
  async function submitClosedEdit() {
    if (!closedEdit || !selected) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/investments/v2/closed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", transactionId: closedEdit.id, transactionDate: new Date(closedEditDate).toISOString(), unitPrice: Number(closedEditPrice), taxAmount: Number(closedEditTax || 0), otherCharges: Number(closedEditOther || 0) }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Closed transaction update failed.");
      await reload(); await loadLedger(selected.id); setClosedEdit(null); setMessage("Closed transaction updated.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Closed transaction update failed."); }
    finally { setBusy(false); }
  }
  '''
if handler_anchor not in text:
    raise SystemExit("sellAll anchor not found. No changes made.")
text = text.replace(handler_anchor, handlers + handler_anchor, 1)

header_old = '<th>Realized P/L</th><th className="text-right">Status</th>'
header_new = '<th>Realized P/L</th><th className="text-right">Action</th>'
if header_old not in text:
    raise SystemExit("Closed transaction header anchor not found. No changes made.")
text = text.replace(header_old, header_new, 1)

cell_old = '<td className="text-right text-slate-500">SOLD</td></tr>)}</tbody></table></div>}</div></section>}'
cell_new = '<td className="text-right whitespace-nowrap"><button type="button" onClick={()=>{const d=new Date(x.sale.date).toISOString().slice(0,10);setClosedEdit({id:x.sale.id,asset:x.lot.asset,quantity:Number(x.sale.quantity),date:d,price:Number(x.sale.price)});setClosedEditDate(d);setClosedEditPrice(String(x.sale.price));setClosedEditTax("0");setClosedEditOther("0");}} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-300">Edit</button><button type="button" onClick={()=>deleteClosedTransaction(x.sale.id)} className="ml-2 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300">Delete</button></td></tr>)}</tbody></table></div>}</div></section>}'
if cell_old not in text:
    raise SystemExit("Closed transaction action anchor not found. No changes made.")
text = text.replace(cell_old, cell_new, 1)

sell_modal_line = '<SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} />'
if sell_modal_line not in text:
    raise SystemExit("SellAllModal render anchor not found. No changes made.")
closed_modal_line = sell_modal_line + '\n\n    <ClosedSellEditModal open={Boolean(closedEdit)} edit={closedEdit} account={selected} date={closedEditDate} price={closedEditPrice} tax={closedEditTax} other={closedEditOther} setDate={setClosedEditDate} setPrice={setClosedEditPrice} setTax={setClosedEditTax} setOther={setClosedEditOther} onClose={()=>setClosedEdit(null)} onSubmit={submitClosedEdit} busy={busy} />'
text = text.replace(sell_modal_line, closed_modal_line, 1)

path.write_text(text)
print("Applied closed transaction Edit/Delete UI to V6")
