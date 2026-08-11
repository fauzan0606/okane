"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { updateSplitBillItemAction } from "../actions";

type Participant = { id: string; name: string; isMe: boolean };
type Allocation = { participantId: string; units: number };

type Props = {
  splitBillId: string;
  itemId: string;
  participants: Participant[];
  allocations: Allocation[];
  splitMethod: "EQUAL" | "PRO_RATA";
  disabled?: boolean;
};

export default function SplitBillItemEditor({ splitBillId, itemId, participants, allocations, splitMethod, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState(splitMethod);
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(allocations.map((allocation) => [allocation.participantId, String(allocation.units)])));

  function toggle(id: string) {
    setSelected((current) => {
      const next = { ...current };
      if (next[id]) delete next[id]; else next[id] = "1";
      return next;
    });
  }

  function start() {
    setMethod(splitMethod);
    setSelected(Object.fromEntries(allocations.map((allocation) => [allocation.participantId, String(allocation.units)])));
    setEditing(true);
  }

  if (!editing) return <button type="button" disabled={disabled} onClick={start} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1 text-[9px] font-semibold text-slate-400 hover:border-emerald-400/30 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"><Pencil size={11} /> Edit</button>;

  const payload = participants.filter((participant) => selected[participant.id]).map((participant) => ({ participantId: participant.id, units: Number(selected[participant.id]) || 0 })).filter((allocation) => allocation.units > 0);

  return <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-300">Edit who had this</p><div className="flex rounded-lg border border-white/10 bg-[#0B141F] p-0.5"><button type="button" onClick={() => setMethod("EQUAL")} className={`rounded-md px-2.5 py-1 text-[9px] font-semibold ${method === "EQUAL" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Equal</button><button type="button" onClick={() => setMethod("PRO_RATA")} className={`rounded-md px-2.5 py-1 text-[9px] font-semibold ${method === "PRO_RATA" ? "bg-emerald-400/10 text-emerald-300" : "text-slate-500"}`}>Pro-rata</button></div></div>
    <div className="mt-2 flex flex-wrap gap-2">{participants.map((participant) => <button key={participant.id} type="button" onClick={() => toggle(participant.id)} className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${selected[participant.id] ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.02] text-slate-400"}`}>{selected[participant.id] ? "✓ " : ""}{participant.name}</button>)}</div>
    {method === "PRO_RATA" && <div className="mt-2 grid gap-2 sm:grid-cols-3">{participants.filter((participant) => selected[participant.id]).map((participant) => <label key={participant.id} className="text-[9px] text-slate-500"><span className="mb-1 block">{participant.name}</span><input value={selected[participant.id] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [participant.id]: event.target.value }))} inputMode="decimal" min="0" className="w-full rounded-lg border border-[#30465D] bg-[#0A1119] px-2 py-1.5 text-xs text-white outline-none" /></label>)}</div>}
    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] font-semibold text-slate-400"><X size={11} /> Cancel</button><form action={updateSplitBillItemAction}><input type="hidden" name="splitBillId" value={splitBillId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="splitMethod" value={method} /><input type="hidden" name="allocations" value={JSON.stringify(payload)} /><button type="submit" disabled={payload.length === 0} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[9px] font-bold text-[#07110b] disabled:opacity-40"><Check size={11} /> Save</button></form></div>
  </div>;
}
