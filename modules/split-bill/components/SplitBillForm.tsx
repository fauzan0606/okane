"use client";

import { useMemo, useState } from "react";
import { Plus, ReceiptText, Trash2, UsersRound } from "lucide-react";
import { createSplitBillAction } from "../actions";

type TransactionOption = { id: string; date: string; merchant: string; amount: number; wallet: string; currency: string; symbol: string };
type Participant = { name: string; isMe: boolean };
type Item = { name: string; quantity: string; unitPrice: string; splitMethod: "EQUAL" | "PRO_RATA"; units: string[] };

type Props = { transactions: TransactionOption[] };

const inputClass = "w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50";

function money(value: number, symbol: string) { return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`; }

export default function SplitBillForm({ transactions }: Props) {
  const [transactionId, setTransactionId] = useState(transactions[0]?.id ?? "");
  const [participants, setParticipants] = useState<Participant[]>([{ name: "You", isMe: true }, { name: "", isMe: false }]);
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: "1", unitPrice: "", splitMethod: "EQUAL", units: ["1", "1"] }]);
  const [note, setNote] = useState("");

  const selected = transactions.find((transaction) => transaction.id === transactionId) ?? null;
  const itemTotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0), [items]);
  const shares = useMemo(() => {
    const totals = participants.map(() => 0);
    items.forEach((item) => {
      const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const units = item.splitMethod === "EQUAL" ? participants.map(() => 1) : participants.map((_, index) => Number(item.units[index]) || 0);
      const unitTotal = units.reduce((sum, unit) => sum + unit, 0);
      if (!unitTotal) return;
      units.forEach((unit, index) => { totals[index] += amount * unit / unitTotal; });
    });
    return totals;
  }, [items, participants]);
  const personalIndex = participants.findIndex((participant) => participant.isMe);
  const personalShare = personalIndex >= 0 ? shares[personalIndex] : 0;
  const receivable = shares.reduce((sum, value, index) => sum + (index === personalIndex ? 0 : value), 0);
  const valid = Boolean(selected) && participants.filter((participant) => !participant.isMe && participant.name.trim()).length >= 1 && itemTotal === Number(selected?.amount ?? 0) && items.every((item) => item.name.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && (item.splitMethod === "EQUAL" || item.units.some((unit) => Number(unit) > 0)));

  function addParticipant() {
    setParticipants((current) => [...current, { name: "", isMe: false }]);
    setItems((current) => current.map((item) => ({ ...item, units: [...item.units, "1"] })));
  }

  function removeParticipant(index: number) {
    if (participants.length <= 2 || participants[index]?.isMe) return;
    setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index));
    setItems((current) => current.map((item) => ({ ...item, units: item.units.filter((_, participantIndex) => participantIndex !== index) })));
  }

  function updateParticipant(index: number, name: string) { setParticipants((current) => current.map((participant, participantIndex) => participantIndex === index ? { ...participant, name } : participant)); }

  function addItem() { setItems((current) => [...current, { name: "", quantity: "1", unitPrice: "", splitMethod: "EQUAL", units: participants.map(() => "1") }]); }
  function removeItem(index: number) { setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)); }
  function updateItem(index: number, patch: Partial<Item>) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function updateUnit(itemIndex: number, participantIndex: number, value: string) { setItems((current) => current.map((item, index) => index === itemIndex ? { ...item, units: item.units.map((unit, pIndex) => pIndex === participantIndex ? value : unit) } : item)); }

  const payload = JSON.stringify({ transactionId, participants: participants.map((participant) => ({ name: participant.name, isMe: participant.isMe })), items: items.map((item) => ({ name: item.name, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), splitMethod: item.splitMethod, units: item.units.map(Number) })), note });

  return (
    <form action={createSplitBillAction} className="space-y-5">
      <input type="hidden" name="payload" value={payload} />
      <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400"><ReceiptText size={18} /></div><div><h2 className="text-base font-semibold text-white">1. Choose the transaction</h2><p className="mt-1 text-xs text-slate-400">Start from the actual expense already recorded in OKANE.</p></div></div>
        {transactions.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-[#0B141F] p-4 text-sm text-slate-500">No eligible expense transactions yet. Record the full bill first, then split it here.</div> : <select value={transactionId} onChange={(event) => setTransactionId(event.target.value)} className={`${inputClass} mt-4`}><option value="">Select transaction</option>{transactions.map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.date} · {transaction.merchant} · {transaction.currency} {money(transaction.amount, transaction.symbol)}</option>)}</select>}
        {selected && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0B141F] px-4 py-3"><div><p className="text-xs font-semibold text-white">{selected.merchant}</p><p className="mt-0.5 text-[10px] text-slate-500">{selected.wallet} · {selected.date}</p></div><p className="text-lg font-bold text-white">{money(selected.amount, selected.symbol)}</p></div>}
      </section>

      <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-blue-400"><UsersRound size={18} /></div><div><h2 className="text-base font-semibold text-white">2. Who is sharing?</h2><p className="mt-1 text-xs text-slate-400">You are always included. Add the friends who owe you money.</p></div></div><button type="button" onClick={addParticipant} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B141F] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/30"><Plus size={13} /> Add person</button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{participants.map((participant, index) => <div key={index} className="flex items-center gap-2"><input value={participant.name} onChange={(event) => updateParticipant(index, event.target.value)} disabled={participant.isMe} placeholder={participant.isMe ? "You" : "Friend name"} className={`${inputClass} ${participant.isMe ? "text-emerald-300" : ""}`} />{!participant.isMe && <button type="button" onClick={() => removeParticipant(index)} className="rounded-lg border border-red-400/10 bg-red-400/[0.04] p-2 text-red-300" title="Remove person"><Trash2 size={14} /></button>}</div>)}</div>
      </section>

      <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-white">3. Add the bill items</h2><p className="mt-1 text-xs text-slate-400">For shared quantities, use Pro-rata. Example: 5 / 3 / 2.</p></div><button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B141F] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/30"><Plus size={13} /> Add item</button></div>
        <div className="mt-4 space-y-3">{items.map((item, itemIndex) => <div key={itemIndex} className="rounded-2xl border border-white/10 bg-[#0B141F] p-4"><div className="grid gap-2 md:grid-cols-[1fr_100px_130px_130px_auto]"><input value={item.name} onChange={(event) => updateItem(itemIndex, { name: event.target.value })} placeholder="Item / dish / tax" className={inputClass} /><input value={item.quantity} onChange={(event) => updateItem(itemIndex, { quantity: event.target.value })} inputMode="decimal" placeholder="Qty" className={inputClass} /><input value={item.unitPrice} onChange={(event) => updateItem(itemIndex, { unitPrice: event.target.value })} inputMode="decimal" placeholder="Unit price" className={inputClass} /><select value={item.splitMethod} onChange={(event) => updateItem(itemIndex, { splitMethod: event.target.value as Item["splitMethod"] })} className={inputClass}><option value="EQUAL">Equal</option><option value="PRO_RATA">Pro-rata</option></select><button type="button" onClick={() => removeItem(itemIndex)} className="rounded-xl border border-red-400/10 bg-red-400/[0.04] p-2.5 text-red-300" title="Remove item"><Trash2 size={15} /></button></div>{item.splitMethod === "PRO_RATA" && <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">Share units</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{participants.map((participant, participantIndex) => <label key={participantIndex} className="text-[10px] text-slate-400"><span className="mb-1 block">{participant.name || `Person ${participantIndex + 1}`}</span><input value={item.units[participantIndex] ?? "0"} onChange={(event) => updateUnit(itemIndex, participantIndex, event.target.value)} inputMode="decimal" className={inputClass} /></label>)}</div></div>}<div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px]"><span className="text-slate-500">Item total: <span className="font-semibold text-slate-300">{selected ? money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), selected.symbol) : "—"}</span></span>{item.splitMethod === "EQUAL" ? <span className="text-slate-500">Split equally across {participants.length} people</span> : <span className="text-emerald-300">Split according to units</span>}</div></div>)}</div>
      </section>

      <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="grid gap-4 md:grid-cols-3"><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Bill total</p><p className={`mt-1 text-xl font-bold ${selected && itemTotal === selected.amount ? "text-emerald-300" : "text-white"}`}>{selected ? money(itemTotal, selected.symbol) : "—"}</p><p className="mt-1 text-[10px] text-slate-600">Target: {selected ? money(selected.amount, selected.symbol) : "—"}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Your share</p><p className="mt-1 text-xl font-bold text-white">{selected ? money(personalShare, selected.symbol) : "—"}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">To receive</p><p className="mt-1 text-xl font-bold text-emerald-300">{selected ? money(receivable, selected.symbol) : "—"}</p></div></div><label className="mt-4 block"><span className="text-xs font-medium text-slate-300">Note <span className="text-slate-600">(optional)</span></span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Dinner at Sushi Hiro" className={`${inputClass} mt-2`} /></label><div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-4"><p className="text-[10px] text-slate-500">The original transaction stays at the full amount. OKANE uses your share for personal expense and creates receivables for friends.</p><button type="submit" disabled={!valid} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40">Create Split Bill</button></div></section>
    </form>
  );
}
