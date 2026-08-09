import { HandCoins, ArrowRight } from "lucide-react";
import { getReceivables } from "../service";

function money(value: number) { return `Rp${value.toLocaleString("id-ID")}`; }

export default async function ReceivableSummary() {
  const items = await getReceivables();
  const open = items.filter((item) => item.status !== "RECEIVED");
  const total = open.reduce((sum, item) => sum + item.remaining, 0);
  if (total <= 0) return null;

  return (
    <section className="mb-5 rounded-[20px] border border-amber-400/10 bg-[#0d151e] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><HandCoins size={18} /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Money to receive</p><p className="mt-0.5 text-xl font-bold text-white">{money(total)}</p><p className="text-[11px] text-slate-500">{open.length} outstanding receivable{open.length === 1 ? "" : "s"}</p></div></div>
        <div className="flex flex-wrap items-center gap-3">{open.slice(0, 3).map((item) => <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2"><p className="max-w-[150px] truncate text-[10px] text-slate-500">{item.personName}</p><p className="text-xs font-semibold text-slate-200">{money(item.remaining)}</p></div>)}<a href="/receivables" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300">View receivables <ArrowRight size={12} /></a></div>
      </div>
    </section>
  );
}
