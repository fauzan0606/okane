import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { createReceivableAction, recordReceivablePaymentAction } from "@/modules/receivable/actions";
import { getReceivables, refreshReceivableStatuses } from "@/modules/receivable/service";
import { ArrowDownLeft, CalendarDays, CircleDollarSign, Plus, UserRound } from "lucide-react";

function money(value: number, symbol = "Rp") { return `${symbol}${value.toLocaleString("id-ID")}`; }
function date(value: Date | string | null) { return value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—"; }
function statusMeta(status: string) {
  if (status === "RECEIVED") return { label: "RECEIVED", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" };
  if (status === "PARTIALLY_RECEIVED") return { label: "PARTIALLY RECEIVED", className: "border-amber-400/20 bg-amber-400/10 text-amber-300" };
  if (status === "OVERDUE") return { label: "OVERDUE", className: "border-red-400/20 bg-red-400/10 text-red-300" };
  return { label: "OUTSTANDING", className: "border-white/10 bg-white/5 text-slate-300" };
}

export default async function ReceivablesPage() {
  await refreshReceivableStatuses();
  const [items, wallets] = await Promise.all([
    getReceivables(),
    prisma.wallet.findMany({ where: { isActive: true, walletType: { not: "CREDIT_CARD" } }, select: { id: true, name: true, currency: { select: { symbol: true, code: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const outstanding = items.filter((item) => item.status !== "RECEIVED");
  const totalRemaining = outstanding.reduce((sum, item) => sum + item.remaining, 0);
  const overdue = outstanding.filter((item) => item.status === "OVERDUE").length;

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Money to receive</p><h1 className="mt-1 text-3xl font-bold text-white">Receivables</h1><p className="mt-2 text-sm text-slate-500">Track money others owe you without treating reimbursements as personal income.</p></div><a href="#new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b]"><Plus size={15} /> New Receivable</a></div>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[18px] border border-emerald-400/10 bg-[#0d141e] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Total to Receive</p><p className="mt-1 text-xl font-semibold text-emerald-300">{money(totalRemaining)}</p><p className="mt-1 text-[10px] text-slate-600">Outstanding across all people</p></div>
          <div className="rounded-[18px] border border-white/10 bg-[#0d141e] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Open Receivables</p><p className="mt-1 text-xl font-semibold text-white">{outstanding.length}</p></div>
          <div className={`rounded-[18px] border px-4 py-4 ${overdue ? "border-red-400/20 bg-red-400/[0.04]" : "border-white/10 bg-[#0d141e]"}`}><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Overdue</p><p className={`mt-1 text-xl font-semibold ${overdue ? "text-red-300" : "text-emerald-300"}`}>{overdue}</p></div>
        </section>

        <section id="new" className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5"><div className="flex items-center gap-2"><CircleDollarSign size={18} className="text-emerald-400" /><div><h2 className="text-sm font-semibold text-white">Add Receivable</h2><p className="text-[11px] text-slate-500">Use this for a personal amount owed to you. Split Bill will create these automatically later.</p></div></div><form action={createReceivableAction} className="mt-4 grid gap-3 md:grid-cols-4"><input name="personName" required placeholder="Person name" className="rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600" /><input name="description" required placeholder="What is this for?" className="rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600" /><input name="amount" required inputMode="decimal" placeholder="Amount" className="rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600" /><div className="flex gap-2"><input name="dueDate" type="date" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none" /><button className="rounded-xl bg-emerald-500 px-4 text-xs font-bold text-[#07110b]">Save</button></div></form></section>

        <section className="space-y-3">
          {items.length === 0 ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0d151e] p-12 text-center"><UserRound size={26} className="mx-auto text-slate-600" /><p className="mt-3 text-sm font-semibold text-white">No receivables yet</p><p className="mt-1 text-xs text-slate-500">Your future Split Bills will appear here as amounts to receive.</p></div> : items.map((item) => {
            const meta = statusMeta(item.status);
            return <article key={item.id} className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-white">{item.personName}</h2><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${meta.className}`}>{meta.label}</span></div><p className="mt-1 text-sm text-slate-400">{item.description}</p><div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500"><span>Amount {money(item.amount)}</span><span>Received {money(item.receivedAmount)}</span>{item.dueDate && <span className={item.status === "OVERDUE" ? "text-red-300" : ""}><CalendarDays size={12} className="mr-1 inline" />Due {date(item.dueDate)}</span>}</div></div><div className="text-left lg:text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Remaining</p><p className={`mt-1 text-2xl font-bold ${item.remaining > 0 ? "text-white" : "text-emerald-300"}`}>{money(item.remaining)}</p></div></div>{item.status !== "RECEIVED" && <div className="mt-4 border-t border-white/5 pt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Record money received</p><form action={recordReceivablePaymentAction} className="grid gap-2 md:grid-cols-[1fr_1fr_1.2fr_auto]"><input type="hidden" name="receivableId" value={item.id} /><input name="amount" required inputMode="decimal" placeholder={`Up to ${money(item.remaining)}`} className="rounded-xl border border-white/10 bg-[#070c12] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" /><input name="receivedAt" type="date" required className="rounded-xl border border-white/10 bg-[#070c12] px-3 py-2 text-sm text-slate-300 outline-none" /><select name="walletId" required className="rounded-xl border border-white/10 bg-[#070c12] px-3 py-2 text-sm text-slate-300 outline-none"><option value="">Money received into...</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}</select><button className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"><ArrowDownLeft size={14} />Record</button></form></div>}{item.payments.length > 0 && <div className="mt-4 border-t border-white/5 pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Payment History</p><div className="mt-2 space-y-1.5">{item.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between text-xs"><span className="text-slate-500">{date(payment.receivedAt)} · {payment.wallet.name}</span><span className="font-semibold text-emerald-300">+{money(payment.amount, payment.wallet.currency.symbol)}</span></div>)}</div></div>}</article>;
          })}
        </section>
      </div>
    </AppShell>
  );
}
