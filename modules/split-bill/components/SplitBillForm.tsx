"use client";

import { useMemo, useState } from "react";
import { Plus, ReceiptText, Trash2, UsersRound } from "lucide-react";
import { createSplitBillAction } from "../actions";
import SplitBillOcr, { type OcrResult } from "./SplitBillOcr";

type Props = { currencySymbol?: string };
type Participant = { name: string; isMe: boolean };
type Item = { name: string; quantity: string; unitPrice: string; splitMethod: "EQUAL" | "PRO_RATA"; units: string[] };
type Charge = { mode: "AMOUNT" | "PERCENT"; value: string };

const inputClass = "w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50";
function money(value: number, symbol: string) { return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`; }
function roundedMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function chargeAmount(charge: Charge, subtotal: number) { const value = Number(charge.value) || 0; return value > 0 ? (charge.mode === "PERCENT" ? subtotal * value / 100 : value) : 0; }

export default function SplitBillForm({ currencySymbol = "Rp" }: Props) {
  const [merchantName, setMerchantName] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([{ name: "You", isMe: true }, { name: "", isMe: false }]);
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: "1", unitPrice: "", splitMethod: "EQUAL", units: ["", ""] }]);
  const [tax, setTax] = useState<Charge>({ mode: "PERCENT", value: "" });
  const [serviceFee, setServiceFee] = useState<Charge>({ mode: "PERCENT", value: "" });
  const [note, setNote] = useState("");

  const subtotal = useMemo(() => roundedMoney(items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)), [items]);
  const taxAmount = useMemo(() => roundedMoney(chargeAmount(tax, subtotal)), [tax, subtotal]);
  const serviceFeeAmount = useMemo(() => roundedMoney(chargeAmount(serviceFee, subtotal)), [serviceFee, subtotal]);
  const itemTotal = roundedMoney(subtotal + taxAmount + serviceFeeAmount);

  const shares = useMemo(() => {
    const totals = participants.map(() => 0);
    items.forEach((item) => {
      const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const selected = participants.map((_, index) => Number(item.units[index]) || 0);
      const units = item.splitMethod === "EQUAL" ? selected.map((unit) => unit > 0 ? 1 : 0) : selected;
      const unitTotal = units.reduce((sum, unit) => sum + unit, 0);
      if (!unitTotal) return;
      units.forEach((unit, index) => { totals[index] += amount * unit / unitTotal; });
    });
    const base = [...totals];
    const addCharge = (amount: number) => { if (!amount || subtotal <= 0) return; base.forEach((value, index) => { totals[index] += value / subtotal * amount; }); };
    addCharge(taxAmount); addCharge(serviceFeeAmount);
    return totals;
  }, [items, participants, subtotal, taxAmount, serviceFeeAmount]);

  const personalIndex = participants.findIndex((participant) => participant.isMe);
  const personalShare = personalIndex >= 0 ? shares[personalIndex] : 0;
  const receivable = shares.reduce((sum, value, index) => sum + (index === personalIndex ? 0 : value), 0);
  const validCharge = (charge: Charge) => { const value = Number(charge.value); return !charge.value || (Number.isFinite(value) && value >= 0 && (charge.mode === "AMOUNT" || value <= 100)); };
  const valid = merchantName.trim().length > 0 && participants.filter((participant) => !participant.isMe && participant.name.trim()).length >= 1 && items.length > 0 && validCharge(tax) && validCharge(serviceFee) && items.every((item) => {
    const selected = item.units.map((unit) => Number(unit) || 0).filter((unit) => unit > 0);
    return item.name.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && selected.length > 0 && (selected.length <= 1 || item.splitMethod === "EQUAL" || selected.every((unit) => unit > 0));
  });

  function addParticipant() { setParticipants((current) => [...current, { name: "", isMe: false }]); setItems((current) => current.map((item) => ({ ...item, units: [...item.units, ""] }))); }
  function removeParticipant(index: number) { if (participants.length <= 2 || participants[index]?.isMe) return; setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index)); setItems((current) => current.map((item) => ({ ...item, units: item.units.filter((_, participantIndex) => participantIndex !== index) }))); }
  function updateParticipant(index: number, name: string) { setParticipants((current) => current.map((participant, participantIndex) => participantIndex === index ? { ...participant, name } : participant)); }
  function addItem() { setItems((current) => [...current, { name: "", quantity: "1", unitPrice: "", splitMethod: "EQUAL", units: participants.map(() => "") }]); }
  function removeItem(index: number) { setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)); }
  function updateItem(index: number, patch: Partial<Item>) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function toggleParticipant(itemIndex: number, participantIndex: number) {
    setItems((current) => current.map((item, index) => {
      if (index !== itemIndex) return item;
      const currentlySelected = Number(item.units[participantIndex]) > 0;
      const units = item.units.map((unit, pIndex) => pIndex === participantIndex ? (currentlySelected ? "" : "1") : unit);
      const selectedCount = units.filter((unit) => Number(unit) > 0).length;
      return { ...item, units, splitMethod: selectedCount <= 1 ? "EQUAL" : item.splitMethod };
    }));
  }
  function updateUnit(itemIndex: number, participantIndex: number, value: string) { setItems((current) => current.map((item, index) => index === itemIndex ? { ...item, units: item.units.map((unit, pIndex) => pIndex === participantIndex ? value : unit) } : item)); }

  function useOcrResult(result: OcrResult) {
    setMerchantName(result.merchantName);
    if (result.items.length > 0) {
      setItems(result.items.map((item) => ({ name: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice), splitMethod: "EQUAL", units: participants.map(() => "") })));
    }
    if (result.taxAmount !== undefined) setTax({ mode: "AMOUNT", value: String(result.taxAmount) });
    else if (result.taxPercent !== undefined) setTax({ mode: "PERCENT", value: String(result.taxPercent) });
    if (result.serviceAmount !== undefined) setServiceFee({ mode: "AMOUNT", value: String(result.serviceAmount) });
    else if (result.servicePercent !== undefined) setServiceFee({ mode: "PERCENT", value: String(result.servicePercent) });
  }

  const payload = JSON.stringify({
    merchantName,
    participants: participants.map((participant) => ({ name: participant.name, isMe: participant.isMe })),
    items: items.map((item) => ({ name: item.name, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), splitMethod: item.splitMethod, units: item.units.map((unit) => Number(unit) || 0) })),
    tax: tax.value ? { mode: tax.mode, value: Number(tax.value) } : undefined,
    serviceFee: serviceFee.value ? { mode: serviceFee.mode, value: Number(serviceFee.value) } : undefined,
    note,
  });

  return <form action={createSplitBillAction} className="space-y-5">
    <input type="hidden" name="payload" value={payload} />
    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400"><ReceiptText size={18} /></div><div><h2 className="text-base font-semibold text-white">1. What are we splitting?</h2><p className="mt-1 text-xs text-slate-400">For a new Split Bill, you only need the merchant first. Date and wallet can be added later when you finalize it into your finances.</p></div></div>
      <input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} placeholder="Merchant / restaurant name" className={`${inputClass} mt-4`} />
      <div className="mt-4 border-t border-white/5 pt-4"><SplitBillOcr onUseResult={useOcrResult} /></div>
    </section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="flex items-center justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-blue-400"><UsersRound size={18} /></div><div><h2 className="text-base font-semibold text-white">2. Who is sharing?</h2><p className="mt-1 text-xs text-slate-400">You are always included. Add the friends who owe you money.</p></div></div><button type="button" onClick={addParticipant} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B141F] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/30"><Plus size={13} /> Add person</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{participants.map((participant, index) => <div key={index} className="flex items-center gap-2"><input value={participant.name} onChange={(event) => updateParticipant(index, event.target.value)} disabled={participant.isMe} placeholder={participant.isMe ? "You" : "Friend name"} className={`${inputClass} ${participant.isMe ? "text-emerald-300" : ""}`} />{!participant.isMe && <button type="button" onClick={() => removeParticipant(index)} className="rounded-lg border border-red-400/10 bg-red-400/[0.04] p-2 text-red-300" title="Remove person"><Trash2 size={14} /></button>}</div>)}</div></section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-white">3. Who had what?</h2><p className="mt-1 text-xs text-slate-400">Choose who had each item. Nothing is pre-selected. If more than one person had it, choose Equal or Pro-rata.</p></div><button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B141F] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/30"><Plus size={13} /> Add item</button></div><div className="mt-4 space-y-3">{items.map((item, itemIndex) => {
      const selectedCount = item.units.filter((unit) => Number(unit) > 0).length;
      return <div key={itemIndex} className="rounded-2xl border border-white/10 bg-[#0B141F] p-4">
        <div className="grid gap-2 md:grid-cols-[1fr_90px_130px_auto]"><input value={item.name} onChange={(event) => updateItem(itemIndex, { name: event.target.value })} placeholder="Item / dish" className={inputClass} /><input value={item.quantity} onChange={(event) => updateItem(itemIndex, { quantity: event.target.value })} inputMode="decimal" placeholder="Qty" className={inputClass} /><input value={item.unitPrice} onChange={(event) => updateItem(itemIndex, { unitPrice: event.target.value })} inputMode="decimal" placeholder="Unit price" className={inputClass} /><button type="button" onClick={() => removeItem(itemIndex)} className="rounded-xl border border-red-400/10 bg-red-400/[0.04] p-2.5 text-red-300" title="Remove item"><Trash2 size={15} /></button></div>
        <div className="mt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Who had this?</p><div className="flex flex-wrap gap-2">{participants.map((participant, participantIndex) => { const selected = Number(item.units[participantIndex]) > 0; return <button key={participantIndex} type="button" onClick={() => toggleParticipant(itemIndex, participantIndex)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${selected ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"}`}>{selected ? "✓ " : ""}{participant.name || (participant.isMe ? "You" : `Person ${participantIndex + 1}`)}</button>; })}</div></div>
        {selectedCount > 1 && <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">How should this item be split?</p><div className="flex rounded-lg border border-white/10 bg-[#0B141F] p-0.5"><button type="button" onClick={() => updateItem(itemIndex, { splitMethod: "EQUAL" })} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${item.splitMethod === "EQUAL" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Equal</button><button type="button" onClick={() => updateItem(itemIndex, { splitMethod: "PRO_RATA" })} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${item.splitMethod === "PRO_RATA" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Pro-rata</button></div></div>{item.splitMethod === "PRO_RATA" && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{participants.map((participant, participantIndex) => { const selected = Number(item.units[participantIndex]) > 0; return selected ? <label key={participantIndex} className="text-[10px] text-slate-400"><span className="mb-1 block">{participant.name || `Person ${participantIndex + 1}`}</span><input value={item.units[participantIndex] ?? ""} onChange={(event) => updateUnit(itemIndex, participantIndex, event.target.value)} inputMode="decimal" min="0" className={inputClass} /></label> : null; })}</div>}</div>}
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px]"><span className="text-slate-500">Item total: <span className="font-semibold text-slate-300">{money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), currencySymbol)}</span></span><span className={selectedCount === 0 ? "text-amber-300" : "text-slate-500"}>{selectedCount === 0 ? "Select at least one person" : selectedCount === 1 ? "One person" : item.splitMethod === "EQUAL" ? `Equal across ${selectedCount} people` : "Pro-rata by units"}</span></div>
      </div>;
    })}</div></section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div><h2 className="text-base font-semibold text-white">4. Tax & service fee</h2><p className="mt-1 text-xs text-slate-400">Optional. Percentage fees are allocated proportionally to each person&apos;s item share.</p></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-white/10 bg-[#0B141F] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-300">Tax / PPN</span><span className="text-[10px] text-slate-600">{money(taxAmount, currencySymbol)}</span></div><div className="mt-2 flex gap-2"><select value={tax.mode} onChange={(event) => setTax((current) => ({ ...current, mode: event.target.value as Charge["mode"] }))} className={`${inputClass} w-28`}><option value="PERCENT">%</option><option value="AMOUNT">Amount</option></select><input value={tax.value} onChange={(event) => setTax((current) => ({ ...current, value: event.target.value }))} inputMode="decimal" placeholder={tax.mode === "PERCENT" ? "e.g. 11" : "e.g. 55000"} className={inputClass} /></div></div><div className="rounded-xl border border-white/10 bg-[#0B141F] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-300">Service Fee</span><span className="text-[10px] text-slate-600">{money(serviceFeeAmount, currencySymbol)}</span></div><div className="mt-2 flex gap-2"><select value={serviceFee.mode} onChange={(event) => setServiceFee((current) => ({ ...current, mode: event.target.value as Charge["mode"] }))} className={`${inputClass} w-28`}><option value="PERCENT">%</option><option value="AMOUNT">Amount</option></select><input value={serviceFee.value} onChange={(event) => setServiceFee((current) => ({ ...current, value: event.target.value }))} inputMode="decimal" placeholder={serviceFee.mode === "PERCENT" ? "e.g. 5" : "e.g. 25000"} className={inputClass} /></div></div></div></section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="grid gap-4 md:grid-cols-3"><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Bill total</p><p className="mt-1 text-xl font-bold text-white">{money(itemTotal, currencySymbol)}</p><p className="mt-1 text-[10px] text-slate-600">Subtotal {money(subtotal, currencySymbol)} · Tax {money(taxAmount, currencySymbol)} · Service {money(serviceFeeAmount, currencySymbol)}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Your share</p><p className="mt-1 text-xl font-bold text-white">{money(personalShare, currencySymbol)}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">To receive</p><p className="mt-1 text-xl font-bold text-emerald-300">{money(receivable, currencySymbol)}</p></div></div><label className="mt-4 block"><span className="text-xs font-medium text-slate-300">Note <span className="text-slate-600">(optional)</span></span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Dinner at Sushi Hiro" className={`${inputClass} mt-2`} /></label><div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-4"><p className="text-[10px] text-slate-500">Save this Split Bill first. Date, wallet, transaction and receivables will be created only when you finalize it.</p><button type="submit" disabled={!valid} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40">Save Split Bill</button></div></section>
  </form>;
}
