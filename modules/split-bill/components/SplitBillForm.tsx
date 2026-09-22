"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ReceiptText, Trash2, UsersRound } from "lucide-react";
import { createSplitBillAction } from "../actions";
import SplitBillOcr, { type OcrResult } from "./SplitBillOcr";

type Props = { currencySymbol?: string; onSaved?: () => void };
type Participant = { name: string; isMe: boolean };
type SplitBillMode = "PERSONAL" | "OTHERS_ONLY";
type Item = { name: string; quantity: string; unitPrice: string; splitMethod: "EQUAL" | "PRO_RATA"; units: string[] };
type ChargeTreatment = "INCLUDED" | "EXCLUDED" | "UNKNOWN";
type Charge = { mode: "AMOUNT" | "PERCENT"; value: string; treatment?: ChargeTreatment };
type OcrDiscount = { name: string; amount: number; percent?: number; scope: "ORDER" | "DELIVERY" | "ITEM" };
type DeliverySplitMethod = "EQUAL" | "PRO_RATA";

const inputClass = "w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50";
function money(value: number, symbol: string) { return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`; }
function roundedMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function chargeAmount(charge: Charge, subtotal: number) {
  const value = Number(charge.value) || 0;
  if (value <= 0) return 0;
  if (charge.treatment === "INCLUDED") {
    return charge.mode === "PERCENT" ? subtotal * value / (100 + value) : value;
  }
  return charge.mode === "PERCENT" ? subtotal * value / 100 : value;
}

export default function SplitBillForm({ currencySymbol = "Rp", onSaved }: Props) {
  const [merchantName, setMerchantName] = useState("");
  const [mode, setMode] = useState<SplitBillMode>("PERSONAL");
  const [participants, setParticipants] = useState<Participant[]>([{ name: "You", isMe: true }, { name: "", isMe: false }]);
  const [payerIndex, setPayerIndex] = useState(0);
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: "1", unitPrice: "", splitMethod: "EQUAL", units: ["", ""] }]);
  const [orderDiscount, setOrderDiscount] = useState<Charge>({ mode: "AMOUNT", value: "" });
  const [tax, setTax] = useState<Charge>({ mode: "PERCENT", value: "", treatment: "EXCLUDED" });
  const [serviceFee, setServiceFee] = useState<Charge>({ mode: "PERCENT", value: "", treatment: "EXCLUDED" });
  const [deliveryFee, setDeliveryFee] = useState<Charge>({ mode: "AMOUNT", value: "" });
  const [deliveryDiscount, setDeliveryDiscount] = useState<Charge>({ mode: "AMOUNT", value: "" });
  const [deliverySplitMethod, setDeliverySplitMethod] = useState<DeliverySplitMethod>("EQUAL");
  const [ocrDiscounts, setOcrDiscounts] = useState<OcrDiscount[]>([]);
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const subtotal = useMemo(() => roundedMoney(items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)), [items]);
  const orderDiscountAmount = useMemo(() => Math.min(roundedMoney(chargeAmount(orderDiscount, subtotal)), subtotal), [orderDiscount, subtotal]);
  const discountedSubtotal = useMemo(() => roundedMoney(Math.max(subtotal - orderDiscountAmount, 0)), [subtotal, orderDiscountAmount]);
  const taxAmount = useMemo(() => roundedMoney(chargeAmount(tax, discountedSubtotal)), [tax, discountedSubtotal]);
  const serviceFeeAmount = useMemo(() => roundedMoney(chargeAmount(serviceFee, discountedSubtotal)), [serviceFee, discountedSubtotal]);
  const deliveryFeeAmount = useMemo(() => roundedMoney(chargeAmount(deliveryFee, subtotal)), [deliveryFee, subtotal]);
  const deliveryDiscountAmount = useMemo(() => Math.min(roundedMoney(chargeAmount(deliveryDiscount, subtotal)), deliveryFeeAmount), [deliveryDiscount, subtotal, deliveryFeeAmount]);
  const netDeliveryAmount = useMemo(() => roundedMoney(Math.max(deliveryFeeAmount - deliveryDiscountAmount, 0)), [deliveryFeeAmount, deliveryDiscountAmount]);
  const itemTotal = roundedMoney(discountedSubtotal + taxAmount + serviceFeeAmount + netDeliveryAmount);

  const itemShares = useMemo(() => {
    const totals = participants.map(() => 0);
    items.forEach((item) => {
      const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const selected = participants.map((_, index) => Number(item.units[index]) || 0);
      const units = item.splitMethod === "EQUAL" ? selected.map((unit) => unit > 0 ? 1 : 0) : selected;
      const unitTotal = units.reduce((sum, unit) => sum + unit, 0);
      if (!unitTotal) return;
      units.forEach((unit, index) => { totals[index] += amount * unit / unitTotal; });
    });
    return totals;
  }, [items, participants]);

  const discountedItemShares = useMemo(() => {
    if (orderDiscountAmount <= 0 || subtotal <= 0) return [...itemShares];
    return itemShares.map((value) => roundedMoney(value * discountedSubtotal / subtotal));
  }, [itemShares, orderDiscountAmount, subtotal, discountedSubtotal]);

  const shares = useMemo(() => {
    const totals = [...discountedItemShares];
    const addProportionalCharge = (amount: number) => {
      if (!amount || discountedSubtotal <= 0) return;
      discountedItemShares.forEach((value, index) => { totals[index] += value / discountedSubtotal * amount; });
    };
    addProportionalCharge(taxAmount);
    addProportionalCharge(serviceFeeAmount);
    if (netDeliveryAmount > 0) {
      const eligible = discountedItemShares.map((value) => value > 0);
      const eligibleCount = eligible.filter(Boolean).length;
      const baseTotal = discountedItemShares.reduce((sum, value) => sum + value, 0);
      discountedItemShares.forEach((value, index) => {
        if (!eligible[index]) return;
        totals[index] += deliverySplitMethod === "EQUAL" ? netDeliveryAmount / eligibleCount : baseTotal > 0 ? netDeliveryAmount * value / baseTotal : 0;
      });
    }
    return totals;
  }, [discountedItemShares, discountedSubtotal, taxAmount, serviceFeeAmount, netDeliveryAmount, deliverySplitMethod]);

  const personalIndex = participants.findIndex((participant) => participant.isMe);
  const personalShare = personalIndex >= 0 ? shares[personalIndex] : 0;
  const receivable = mode === "PERSONAL" && personalIndex >= 0 ? shares.reduce((sum, value, index) => sum + (index === personalIndex ? 0 : value), 0) : 0;
  const validCharge = (charge: Charge) => {
    const value = Number(charge.value);
    return !charge.value || (Number.isFinite(value) && value >= 0 && (charge.mode === "AMOUNT" || value <= 100));
  };
  const hasValidParticipants = mode === "PERSONAL"
    ? participants.filter((participant) => !participant.isMe && participant.name.trim()).length >= 1 && participants.filter((participant) => participant.isMe).length === 1
    : participants.length >= 2 && participants.every((participant) => !participant.isMe && participant.name.trim().length > 0);
  const hasValidPayer = payerIndex >= 0 && payerIndex < participants.length && Boolean(participants[payerIndex]?.name.trim());
  const valid = merchantName.trim().length > 0 && hasValidParticipants && hasValidPayer && items.length > 0 && validCharge(orderDiscount) && validCharge(tax) && validCharge(serviceFee) && validCharge(deliveryFee) && validCharge(deliveryDiscount) && !(tax.value && tax.treatment === "UNKNOWN") && !(serviceFee.value && serviceFee.treatment === "UNKNOWN") && items.every((item) => {
    const selected = item.units.map((unit) => Number(unit) || 0).filter((unit) => unit > 0);
    return item.name.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && selected.length > 0 && (selected.length <= 1 || item.splitMethod === "EQUAL" || selected.every((unit) => unit > 0));
  });

  function switchMode(nextMode: SplitBillMode) {
    if (nextMode === mode) return;
    if (nextMode === "OTHERS_ONLY") {
      const meIndex = participants.findIndex((participant) => participant.isMe);
      const remaining = participants.filter((participant) => !participant.isMe);
      const nextParticipants = remaining.length >= 2 ? remaining : [...remaining, { name: "", isMe: false }];
      setParticipants(nextParticipants);
      setItems((current) => current.map((item) => {
        const nextUnits = meIndex >= 0 ? item.units.filter((_, index) => index !== meIndex) : [...item.units];
        while (nextUnits.length < nextParticipants.length) nextUnits.push("");
        return { ...item, units: nextUnits.slice(0, nextParticipants.length) };
      }));
      setPayerIndex(0);
      setMode(nextMode);
      return;
    }
    const nextParticipants = [{ name: "You", isMe: true }, ...participants.filter((participant) => !participant.isMe)];
    setParticipants(nextParticipants);
    setItems((current) => current.map((item) => ({ ...item, units: ["", ...item.units] })));
    setPayerIndex(0);
    setMode(nextMode);
  }

  function addParticipant() { setParticipants((current) => [...current, { name: "", isMe: false }]); setItems((current) => current.map((item) => ({ ...item, units: [...item.units, ""] }))); }
  function removeParticipant(index: number) { if (participants.length <= 2 || participants[index]?.isMe) return; setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index)); setItems((current) => current.map((item) => ({ ...item, units: item.units.filter((_, participantIndex) => participantIndex !== index) }))); setPayerIndex((current) => current === index ? 0 : current > index ? current - 1 : current); }
  function updateParticipant(index: number, name: string) { setParticipants((current) => current.map((participant, participantIndex) => participantIndex === index ? { ...participant, name } : participant)); }
  function addItem() { setItems((current) => [...current, { name: "", quantity: "1", unitPrice: "", splitMethod: "EQUAL", units: participants.map(() => "") }]); }
  function removeItem(index: number) { setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)); }
  function updateItem(index: number, patch: Partial<Item>) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function toggleParticipant(itemIndex: number, participantIndex: number) {
    setItems((current) => current.map((item, index) => {
      if (index !== itemIndex) return item;
      const currentlySelected = item.units[participantIndex] !== "";
      const units = item.units.map((unit, pIndex) => pIndex === participantIndex ? (currentlySelected ? "" : "1") : unit);
      const selectedCount = units.filter((unit) => unit !== "").length;
      return { ...item, units, splitMethod: selectedCount <= 1 ? "EQUAL" : item.splitMethod };
    }));
  }
  function updateUnit(itemIndex: number, participantIndex: number, value: string) { setItems((current) => current.map((item, index) => index === itemIndex ? { ...item, units: item.units.map((unit, pIndex) => pIndex === participantIndex ? (value === "" ? "0" : value) : unit) } : item)); }

  function useOcrResult(result: OcrResult) {
    const enriched = result as OcrResult & { discounts?: OcrDiscount[]; taxMode?: ChargeTreatment; serviceMode?: ChargeTreatment };
    setMerchantName(result.merchantName);
    if (result.items.length > 0) setItems(result.items.map((item) => ({ name: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice), splitMethod: "EQUAL", units: participants.map(() => "") })));
    const discounts = Array.isArray(enriched.discounts) ? enriched.discounts : [];
    setOcrDiscounts(discounts);
    const orderDiscounts = discounts.filter((discount) => discount.scope === "ORDER");
    const orderDiscountTotal = roundedMoney(orderDiscounts.reduce((sum, discount) => sum + Math.abs(Number(discount.amount) || 0), 0));
    setOrderDiscount({ mode: "AMOUNT", value: orderDiscountTotal > 0 ? String(orderDiscountTotal) : "" });
    if (result.taxAmount !== undefined) setTax({ mode: "AMOUNT", value: String(result.taxAmount), treatment: enriched.taxMode ?? "UNKNOWN" });
    else if (result.taxPercent !== undefined) setTax({ mode: "PERCENT", value: String(result.taxPercent), treatment: enriched.taxMode ?? "UNKNOWN" });
    else setTax({ mode: "PERCENT", value: "", treatment: enriched.taxMode ?? "EXCLUDED" });
    if (result.serviceAmount !== undefined) setServiceFee({ mode: "AMOUNT", value: String(result.serviceAmount), treatment: enriched.serviceMode ?? "UNKNOWN" });
    else if (result.servicePercent !== undefined) setServiceFee({ mode: "PERCENT", value: String(result.servicePercent), treatment: enriched.serviceMode ?? "UNKNOWN" });
    else setServiceFee({ mode: "PERCENT", value: "", treatment: enriched.serviceMode ?? "EXCLUDED" });
    if (result.deliveryFeeAmount !== undefined) setDeliveryFee({ mode: "AMOUNT", value: String(result.deliveryFeeAmount) });
    else setDeliveryFee({ mode: "AMOUNT", value: "" });
    if (result.deliveryDiscountAmount !== undefined) setDeliveryDiscount({ mode: "AMOUNT", value: String(result.deliveryDiscountAmount) });
    else setDeliveryDiscount({ mode: "AMOUNT", value: "" });
    setDeliverySplitMethod("EQUAL");
  }

  const participantSummaries = participants.map((participant, index) => ({ ...participant, share: shares[index] ?? 0, percentage: itemTotal > 0 ? (shares[index] ?? 0) / itemTotal * 100 : 0 }));

  function getParticipantBreakdown(participantIndex: number) {
    const normalItems: { name: string; amount: number }[] = [];

    for (const item of items) {
      const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const units = item.units.map((unit) => Number(unit) || 0);
      const splitUnits = item.splitMethod === "EQUAL"
        ? units.map((unit) => (unit > 0 ? 1 : 0))
        : units;
      const unitTotal = splitUnits.reduce((sum, unit) => sum + unit, 0);

      if (!item.name.trim() || unitTotal <= 0 || splitUnits[participantIndex] <= 0) continue;

      normalItems.push({
        name: item.name.trim(),
        amount: roundedMoney(
          amount * splitUnits[participantIndex] / unitTotal,
        ),
      });
    }

    const totalBeforeDiscount = roundedMoney(
      normalItems.reduce((sum, item) => sum + item.amount, 0),
    );
    const subtotalShare = roundedMoney(
      discountedItemShares[participantIndex] ?? totalBeforeDiscount,
    );
    const discount = roundedMoney(
      Math.max(totalBeforeDiscount - subtotalShare, 0),
    );
    const taxShare = roundedMoney(
      discountedSubtotal > 0
        ? subtotalShare / discountedSubtotal * taxAmount
        : 0,
    );
    const serviceShare = roundedMoney(
      discountedSubtotal > 0
        ? subtotalShare / discountedSubtotal * serviceFeeAmount
        : 0,
    );

    const eligible = discountedItemShares.map((value) => value > 0);
    const eligibleCount = eligible.filter(Boolean).length;
    const baseTotal = discountedItemShares.reduce((sum, value) => sum + value, 0);
    const deliveryShare = roundedMoney(
      netDeliveryAmount > 0 && eligible[participantIndex]
        ? deliverySplitMethod === "EQUAL"
          ? netDeliveryAmount / eligibleCount
          : baseTotal > 0
            ? netDeliveryAmount * subtotalShare / baseTotal
            : 0
        : 0,
    );

    return {
      name: participants[participantIndex]?.name ||
        (participants[participantIndex]?.isMe
          ? "You"
          : `Person ${participantIndex + 1}`),
      isMe: participants[participantIndex]?.isMe ?? false,
      normalItems,
      totalBeforeDiscount,
      discount,
      subtotalShare,
      taxShare,
      serviceShare,
      deliveryShare,
      total: roundedMoney(shares[participantIndex] ?? 0),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

    if (valid) {
      setSubmitError("");
      setIsSaving(true);
      try {
        const result = await createSplitBillAction(new FormData(event.currentTarget));
        if (!result.ok) {
          setSubmitError(result.error);
          return;
        }
        onSaved?.();
        router.refresh();
      } catch (error) {
        console.error(error);
        setSubmitError(error instanceof Error ? error.message : "Unable to save Split Bill.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const errors: string[] = [];
    if (!merchantName.trim()) errors.push("Merchant is required.");
    if (mode === "PERSONAL") {
      if (participants.filter((participant) => !participant.isMe && participant.name.trim()).length < 1) errors.push("Add at least one friend and enter their name.");
    } else if (participants.length < 2 || participants.some((participant) => !participant.name.trim())) {
      errors.push("Add at least two people and enter each participant name.");
    }
    if (payerIndex < 0 || payerIndex >= participants.length || !participants[payerIndex]?.name.trim()) errors.push("Choose who paid the bill.");
    if (items.length === 0) errors.push("Add at least one item.");

    items.forEach((item, index) => {
      const selectedCount = item.units.map((unit) => Number(unit) || 0).filter((unit) => unit > 0).length;
      if (!item.name.trim()) errors.push(`Item ${index + 1}: enter an item name.`);
      if (!(Number(item.quantity) > 0)) errors.push(`Item ${index + 1}: quantity must be greater than 0.`);
      if (!(Number(item.unitPrice) >= 0) || !item.unitPrice) errors.push(`Item ${index + 1}: enter a valid unit price.`);
      if (selectedCount === 0) errors.push(`Item ${index + 1}: choose who had this item.`);
      if (selectedCount > 1 && item.splitMethod === "PRO_RATA" && item.units.some((unit) => Number(unit) < 0)) errors.push(`Item ${index + 1}: pro-rata units cannot be negative.`);
    });

    if (!validCharge(orderDiscount)) errors.push("Order discount is invalid.");
    if (!validCharge(tax)) errors.push("Tax is invalid.");
    if (tax.value && tax.treatment === "UNKNOWN") errors.push("Review the tax treatment before saving.");
    if (!validCharge(serviceFee)) errors.push("Service fee is invalid.");
    if (serviceFee.value && serviceFee.treatment === "UNKNOWN") errors.push("Review the service fee treatment before saving.");
    if (!validCharge(deliveryFee)) errors.push("Delivery fee is invalid.");
    if (!validCharge(deliveryDiscount)) errors.push("Delivery discount is invalid.");

    setSubmitError(errors.join(" "));
  }
  const payload = JSON.stringify({
    merchantName,
    mode,
    participants: participants.map((participant) => ({ name: participant.name, isMe: participant.isMe })),
    payerParticipantIndex: payerIndex,
    items: items.map((item) => ({ name: item.name, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), splitMethod: item.splitMethod, units: item.units.map((unit) => Number(unit) || 0) })),
    orderDiscount: orderDiscount.value ? { mode: orderDiscount.mode, value: Number(orderDiscount.value) } : undefined,
    tax: tax.value ? (tax.treatment === "INCLUDED" ? { mode: "AMOUNT", value: tax.mode === "PERCENT" ? roundedMoney(Number(tax.value) * discountedSubtotal / (100 + Number(tax.value))) : Number(tax.value), treatment: "EXCLUDED" } : { mode: tax.mode, value: Number(tax.value), treatment: tax.treatment }) : undefined,
    serviceFee: serviceFee.value ? (serviceFee.treatment === "INCLUDED" ? { mode: "AMOUNT", value: serviceFee.mode === "PERCENT" ? roundedMoney(Number(serviceFee.value) * discountedSubtotal / (100 + Number(serviceFee.value))) : Number(serviceFee.value), treatment: "EXCLUDED" } : { mode: serviceFee.mode, value: Number(serviceFee.value), treatment: serviceFee.treatment }) : undefined,
    deliveryFee: deliveryFee.value ? { mode: deliveryFee.mode, value: Number(deliveryFee.value), splitMethod: deliverySplitMethod } : undefined,
    deliveryDiscount: deliveryDiscount.value ? { mode: deliveryDiscount.mode, value: Number(deliveryDiscount.value) } : undefined,
    note,
  });

  return <form onSubmit={handleSubmit} className="space-y-5">
    <input type="hidden" name="payload" value={payload} />
    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400"><ReceiptText size={18} /></div><div><h2 className="text-base font-semibold text-white">1. What are we splitting?</h2><p className="mt-1 text-xs text-slate-400">For a new Split Bill, you only need the merchant first. Date and wallet can be added later when you finalize it into your finances.</p></div></div>
      <div className="mt-4 flex items-center gap-2">
        <input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} placeholder="Merchant / restaurant name" className={`${inputClass} min-w-0 flex-1`} />
        <button type="button" role="switch" aria-checked={mode === "PERSONAL"} aria-label="I&apos;m part of this bill" onClick={() => switchMode(mode === "PERSONAL" ? "OTHERS_ONLY" : "PERSONAL")} className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition ${mode === "PERSONAL" ? "border-emerald-400/40 bg-emerald-500/80" : "border-white/10 bg-slate-700"}`} title={mode === "PERSONAL" ? "I'm part of this bill" : "Record for other people only"}>
          <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${mode === "PERSONAL" ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>
      <div className="mt-4 border-t border-white/5 pt-4"><SplitBillOcr onUseResult={useOcrResult} /></div>
    </section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="flex items-center justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-blue-400"><UsersRound size={18} /></div><div><h2 className="text-base font-semibold text-white">2. Who is sharing?</h2><p className="mt-1 text-xs text-slate-400">{mode === "PERSONAL" ? "You are included. Add the friends who owe you money." : "You are not included. Add the people who actually shared the bill."}</p></div></div><button type="button" onClick={addParticipant} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B141F] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/30"><Plus size={13} /> Add person</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{participants.map((participant, index) => <div key={index} className="flex items-center gap-2"><input value={participant.name} onChange={(event) => updateParticipant(index, event.target.value)} disabled={participant.isMe} placeholder={participant.isMe ? "You" : mode === "PERSONAL" ? "Friend name" : "Participant name"} className={`${inputClass} ${participant.isMe ? "text-emerald-300" : ""}`} />{!participant.isMe && <button type="button" onClick={() => removeParticipant(index)} className="rounded-lg border border-red-400/10 bg-red-400/[0.04] p-2 text-red-300" title="Remove person"><Trash2 size={14} /></button>}</div>)}</div><div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.03] px-3 py-3"><label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300">Who paid?</label><p className="mb-2 text-[10px] leading-4 text-slate-500">Select the person who actually paid the whole bill. This is used when you finalize the Split Bill.</p><select value={payerIndex} onChange={(event) => setPayerIndex(Number(event.target.value))} className={inputClass} aria-label="Who paid?">{participants.map((participant, index) => <option key={index} value={index}>{participant.isMe ? "You" : (participant.name.trim() || `Person ${index + 1}`)}{index === payerIndex ? " · payer" : ""}</option>)}</select></div></section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-white">3. Who had what?</h2><p className="mt-1 text-xs text-slate-400">Choose who had each item. Nothing is pre-selected. If more than one person had it, choose Equal or Pro-rata.</p></div><button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B141F] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/30"><Plus size={13} /> Add item</button></div><div className="mt-4 space-y-3">{items.map((item, itemIndex) => { const selectedCount = item.units.filter((unit) => unit !== "").length; return <div key={itemIndex} className="rounded-2xl border border-white/10 bg-[#0B141F] p-4">
      <div className="grid gap-2 md:grid-cols-[1fr_90px_130px_auto]"><input value={item.name} onChange={(event) => updateItem(itemIndex, { name: event.target.value })} placeholder="Item / dish" className={inputClass} /><input value={item.quantity} onChange={(event) => updateItem(itemIndex, { quantity: event.target.value })} inputMode="decimal" placeholder="Qty" className={inputClass} /><input value={item.unitPrice} onChange={(event) => updateItem(itemIndex, { unitPrice: event.target.value })} inputMode="decimal" placeholder="Unit price" className={inputClass} /><button type="button" onClick={() => removeItem(itemIndex)} className="rounded-xl border border-red-400/10 bg-red-400/[0.04] p-2.5 text-red-300" title="Remove item"><Trash2 size={15} /></button></div>
      <div className="mt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Who had this?</p><div className="flex flex-wrap gap-2">{participants.map((participant, participantIndex) => { const selected = item.units[participantIndex] !== ""; return <button key={participantIndex} type="button" onClick={() => toggleParticipant(itemIndex, participantIndex)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${selected ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"}`}>{selected ? "✓ " : ""}{participant.name || (participant.isMe ? "You" : `Person ${participantIndex + 1}`)}</button>; })}</div></div>
      {selectedCount > 1 && <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">How should this item be split?</p><div className="flex rounded-lg border border-white/10 bg-[#0B141F] p-0.5"><button type="button" onClick={() => updateItem(itemIndex, { splitMethod: "EQUAL" })} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${item.splitMethod === "EQUAL" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Equal</button><button type="button" onClick={() => updateItem(itemIndex, { splitMethod: "PRO_RATA" })} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${item.splitMethod === "PRO_RATA" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Pro-rata</button></div></div>{item.splitMethod === "PRO_RATA" && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{participants.map((participant, participantIndex) => { const selected = item.units[participantIndex] !== ""; return selected ? <label key={participantIndex} className="text-[10px] text-slate-400"><span className="mb-1 block">{participant.name || `Person ${participantIndex + 1}`}</span><input value={item.units[participantIndex] ?? ""} onChange={(event) => updateUnit(itemIndex, participantIndex, event.target.value)} inputMode="decimal" min="0" className={inputClass} /></label> : null; })}</div>}</div>}
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px]"><span className="text-slate-500">Item total: <span className="font-semibold text-slate-300">{money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), currencySymbol)}</span></span><span className={selectedCount === 0 ? "text-amber-300" : "text-slate-500"}>{selectedCount === 0 ? "Select at least one person" : selectedCount === 1 ? "One person" : item.splitMethod === "EQUAL" ? `Equal across ${selectedCount} people` : "Pro-rata by units"}</span></div>
    </div>; })}</div>
    </section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div><h2 className="text-base font-semibold text-white">4. Charges</h2><p className="mt-1 text-xs text-slate-400">Order discounts reduce the item subtotal first. Tax and service are allocated proportionally. Delivery defaults to Equal, but you can switch it to Pro-rata.</p></div><div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.03] p-3 md:col-span-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-300">Order Discount</span><span className="text-[10px] text-slate-600">-{money(orderDiscountAmount, currencySymbol)}</span></div><div className="mt-2 flex gap-2"><select value={orderDiscount.mode} onChange={(event) => setOrderDiscount((current) => ({ ...current, mode: event.target.value as Charge["mode"] }))} className={`${inputClass} w-28`}><option value="AMOUNT">Amount</option><option value="PERCENT">%</option></select><input value={orderDiscount.value} onChange={(event) => setOrderDiscount((current) => ({ ...current, value: event.target.value }))} inputMode="decimal" placeholder="e.g. 15500" className={inputClass} /></div>{ocrDiscounts.filter((discount) => discount.scope === "ORDER").length > 0 && <p className="mt-2 text-[10px] text-slate-500">{ocrDiscounts.filter((discount) => discount.scope === "ORDER").map((discount) => discount.name).join(" · ")}</p>}</div>
      <div className="rounded-xl border border-white/10 bg-[#0B141F] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-300">Tax / PPN</span><span className="text-[10px] text-slate-600">{money(taxAmount, currencySymbol)}{tax.treatment === "INCLUDED" && " · Included"}</span></div><div className="mt-2 flex gap-2"><select value={tax.mode} onChange={(event) => setTax((current) => ({ ...current, mode: event.target.value as Charge["mode"] }))} className={`${inputClass} w-28`}><option value="PERCENT">%</option><option value="AMOUNT">Amount</option></select><input value={tax.value} onChange={(event) => setTax((current) => ({ ...current, value: event.target.value }))} inputMode="decimal" placeholder={tax.mode === "PERCENT" ? "e.g. 11" : "e.g. 55000"} className={inputClass} /></div><select value={tax.treatment ?? "EXCLUDED"} onChange={(event) => setTax((current) => ({ ...current, treatment: event.target.value as ChargeTreatment }))} className={`${inputClass} mt-2`}><option value="EXCLUDED">Tax excluded</option><option value="INCLUDED">Tax included</option><option value="UNKNOWN">Tax treatment unknown</option></select></div>
      <div className="rounded-xl border border-white/10 bg-[#0B141F] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-300">Service Fee</span><span className="text-[10px] text-slate-600">{money(serviceFeeAmount, currencySymbol)}{serviceFee.treatment === "INCLUDED" && " · Included"}</span></div><div className="mt-2 flex gap-2"><select value={serviceFee.mode} onChange={(event) => setServiceFee((current) => ({ ...current, mode: event.target.value as Charge["mode"] }))} className={`${inputClass} w-28`}><option value="PERCENT">%</option><option value="AMOUNT">Amount</option></select><input value={serviceFee.value} onChange={(event) => setServiceFee((current) => ({ ...current, value: event.target.value }))} inputMode="decimal" placeholder={serviceFee.mode === "PERCENT" ? "e.g. 5" : "e.g. 25000"} className={inputClass} /></div><select value={serviceFee.treatment ?? "EXCLUDED"} onChange={(event) => setServiceFee((current) => ({ ...current, treatment: event.target.value as ChargeTreatment }))} className={`${inputClass} mt-2`}><option value="EXCLUDED">Service excluded</option><option value="INCLUDED">Service included</option><option value="UNKNOWN">Service treatment unknown</option></select></div>
      <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-3 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-xs font-semibold text-slate-200">Delivery Fee</span><p className="mt-1 text-[10px] text-slate-500">Shared charge. Default allocation is Equal among people with items.</p></div><span className="text-xs font-semibold text-slate-200">{money(netDeliveryAmount, currencySymbol)}</span></div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]"><div className="flex gap-2"><select value={deliveryFee.mode} onChange={(event) => setDeliveryFee((current) => ({ ...current, mode: event.target.value as Charge["mode"] }))} className={`${inputClass} w-28`}><option value="AMOUNT">Amount</option><option value="PERCENT">%</option></select><input value={deliveryFee.value} onChange={(event) => setDeliveryFee((current) => ({ ...current, value: event.target.value }))} inputMode="decimal" placeholder="e.g. 14000" className={inputClass} /></div><div className="flex gap-2"><span className="flex items-center text-[10px] text-slate-500">Discount</span><input value={deliveryDiscount.value} onChange={(event) => setDeliveryDiscount((current) => ({ ...current, value: event.target.value }))} inputMode="decimal" placeholder="e.g. 12000" className={inputClass} /></div><div className="flex rounded-lg border border-white/10 bg-[#0B141F] p-0.5"><button type="button" onClick={() => setDeliverySplitMethod("EQUAL")} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${deliverySplitMethod === "EQUAL" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Equal</button><button type="button" onClick={() => setDeliverySplitMethod("PRO_RATA")} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${deliverySplitMethod === "PRO_RATA" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Pro-rata</button></div></div><p className="mt-2 text-[10px] text-slate-600">Delivery {money(deliveryFeeAmount, currencySymbol)} · Discount {money(deliveryDiscountAmount, currencySymbol)} · Net {money(netDeliveryAmount, currencySymbol)} · {deliverySplitMethod === "EQUAL" ? "equal across eligible participants" : "pro-rata by item share"}</p></div>
    </div></section>

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">5. Split summary</h2>
          <p className="mt-1 text-xs text-slate-400">Review the same per-person breakdown shown in the downloaded PDF.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0B141F] px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Bill total</p>
          <p className="mt-0.5 text-xs font-bold text-white">{money(itemTotal, currencySymbol)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {participants.map((_, participantIndex) => {
          const participant = getParticipantBreakdown(participantIndex);

          return (
            <div key={participantIndex} className="rounded-2xl border border-white/10 bg-[#0B141F] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">
                    {participant.name}
                    {participant.isMe && (
                      <span className="ml-1.5 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-300">
                        You
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    ITEMS
                  </p>
                </div>
                <p className="text-base font-bold text-white">
                  {money(participant.total, currencySymbol)}
                </p>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                {participant.normalItems.length === 0 ? (
                  <p className="text-[10px] text-slate-600">No allocated items</p>
                ) : (
                  participant.normalItems.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-slate-300">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-slate-400">
                        {money(item.amount, currencySymbol)}
                      </span>
                    </div>
                  ))
                )}

                <div className="border-t border-white/5 pt-2" />

                <div className="flex items-center justify-between gap-3 font-semibold">
                  <span className="text-slate-300">Total Before Discount</span>
                  <span className="text-white">
                    {money(participant.totalBeforeDiscount, currencySymbol)}
                  </span>
                </div>

                {participant.discount > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Discount</span>
                    <span className="text-amber-300">
                      -{money(participant.discount, currencySymbol)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 font-semibold">
                  <span className="text-slate-300">Subtotal</span>
                  <span className="text-white">
                    {money(participant.subtotalShare, currencySymbol)}
                  </span>
                </div>

                {participant.taxShare > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Tax / PPN</span>
                    <span className="text-slate-400">
                      {money(participant.taxShare, currencySymbol)}
                    </span>
                  </div>
                )}

                {participant.serviceShare > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Service Fee</span>
                    <span className="text-slate-400">
                      {money(participant.serviceShare, currencySymbol)}
                    </span>
                  </div>
                )}

                {participant.deliveryShare > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Delivery Fee</span>
                    <span className="text-slate-400">
                      {money(participant.deliveryShare, currencySymbol)}
                    </span>
                  </div>
                )}

                <div className="border-t border-white/10 pt-2">
                  <div className="flex items-center justify-between gap-3 text-sm font-bold">
                    <span className="text-white">TOTAL</span>
                    <span className="text-white">
                      {money(participant.total, currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500">
        <span>Bill total includes discounted subtotal + tax + service + net delivery.</span>
        <span className={Math.abs(shares.reduce((sum, value) => sum + value, 0) - itemTotal) < 0.01 ? "text-emerald-300" : "text-amber-300"}>
          {Math.abs(shares.reduce((sum, value) => sum + value, 0) - itemTotal) < 0.01
            ? "✓ Fully allocated"
            : "Allocation pending"}
        </span>
      </div>
    </section>
    {mode === "PERSONAL" && (
      <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Bill total</p>
            <p className="mt-1 text-xl font-bold text-white">{money(itemTotal, currencySymbol)}</p>
            <p className="mt-1 text-[10px] text-slate-600">Subtotal {money(subtotal, currencySymbol)} · Discount {money(orderDiscountAmount, currencySymbol)} · Tax {money(taxAmount, currencySymbol)}{tax.treatment === "INCLUDED" ? " included" : ""} · Service {money(serviceFeeAmount, currencySymbol)} · Delivery {money(netDeliveryAmount, currencySymbol)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Your share</p>
            <p className="mt-1 text-xl font-bold text-white">{money(personalShare, currencySymbol)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">To receive</p>
            <p className="mt-1 text-xl font-bold text-emerald-300">{money(receivable, currencySymbol)}</p>
          </div>
        </div>
      </section>
    )}

    <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
      <label className="block">
        <span className="text-xs font-medium text-slate-300">Note <span className="text-slate-600">(optional)</span></span>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Dinner at Sushi Hiro" className={`${inputClass} mt-2`} />
      </label>

      <div className="mt-4 border-t border-white/5 pt-4">
        <p className="text-[10px] text-slate-500">Save this Split Bill first. Date, wallet, transaction and receivables will be created only when you finalize it.</p>
        {submitError && <p role="alert" className="mt-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[10px] leading-4 text-amber-200">{submitError}</p>}
        {isSaving && <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2.5 text-xs text-emerald-200"><span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300 align-[-2px]" />Saving Split Bill… Please wait.</div>}
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={isSaving} className={`inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#07110b] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 ${valid ? "" : "opacity-80"}`}>
            {isSaving ? "Saving…" : "Save Split Bill"}
          </button>
        </div>
      </div>
    </section>
  </form>;
}
