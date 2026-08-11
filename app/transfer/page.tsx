import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { prisma } from "@/lib/prisma";
import { createTransferAction } from "@/modules/transfer/actions";
import { ArrowLeftRight, ArrowRight, CalendarDays, CircleDollarSign, WalletCards } from "lucide-react";

const inputClass = "w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40";
const selectClass = "w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-emerald-400/40";

function todayInput() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatMoney(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function TransferPage() {
  const [wallets, transfers] = await Promise.all([
    prisma.wallet.findMany({
      where: { isActive: true },
      select: { id: true, name: true, walletType: true, currentBalance: true, currency: { select: { code: true, symbol: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.transfer.findMany({
      include: {
        fromWallet: { select: { name: true, currency: { select: { code: true, symbol: true } } } },
        toWallet: { select: { name: true, currency: { select: { code: true, symbol: true } } } },
      },
      orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const serializedWallets = wallets.map((wallet) => ({ ...wallet, currentBalance: Number(wallet.currentBalance) }));
  const serializedTransfers = transfers.map((transfer) => ({ ...transfer, amount: Number(transfer.amount), feeAmount: Number(transfer.feeAmount) }));
  const totalTransfers = serializedTransfers.length;
  const totalFees = serializedTransfers.reduce((sum, transfer) => sum + transfer.feeAmount, 0);
  const currencies = new Set(serializedWallets.map((wallet) => wallet.currency.code));

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-6 px-5 py-6 md:px-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Move money between accounts</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Transfer</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Move money between your own wallets without creating income or expense transactions.</p>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[18px] border border-white/10 bg-[#0d151e] px-4 py-4">
            <div className="flex items-center gap-2 text-slate-500"><ArrowLeftRight size={14} /><span className="text-[10px] uppercase tracking-[0.12em]">Transfers</span></div>
            <p className="mt-1 text-xl font-semibold text-white">{totalTransfers}</p>
            <p className="mt-1 text-[10px] text-slate-600">Latest 50 transfers</p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-[#0d151e] px-4 py-4">
            <div className="flex items-center gap-2 text-slate-500"><CircleDollarSign size={14} /><span className="text-[10px] uppercase tracking-[0.12em]">Currencies</span></div>
            <p className="mt-1 text-xl font-semibold text-white">{currencies.size}</p>
            <p className="mt-1 text-[10px] text-slate-600">Transfers require matching currencies</p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-[#0d151e] px-4 py-4">
            <div className="flex items-center gap-2 text-slate-500"><WalletCards size={14} /><span className="text-[10px] uppercase tracking-[0.12em]">Recorded fees</span></div>
            <p className="mt-1 text-xl font-semibold text-amber-300">{totalFees === 0 ? "—" : totalFees.toLocaleString("id-ID")}</p>
            <p className="mt-1 text-[10px] text-slate-600">Across displayed transfers</p>
          </div>
        </section>

        <section className="rounded-[22px] border border-white/10 bg-[#0d151e] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.16)] md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><ArrowLeftRight size={18} /></div>
            <div><h2 className="text-base font-semibold text-white">New Transfer</h2><p className="mt-1 text-xs text-slate-500">The source wallet decreases and the destination wallet increases automatically.</p></div>
          </div>

          {serializedWallets.length < 2 ? (
            <div className="mt-5 rounded-xl border border-dashed border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm text-amber-200">You need at least two active wallets before creating a transfer.</div>
          ) : (
            <form action={createTransferAction} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-500">Date<input name="transferDate" type="date" required defaultValue={todayInput()} className={`mt-1.5 ${inputClass}`} /></label>
              <label className="text-xs text-slate-500">Amount<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0" className={`mt-1.5 ${inputClass}`} /></label>
              <label className="text-xs text-slate-500">From wallet<select name="fromWalletId" required className={`mt-1.5 ${selectClass}`} defaultValue=""><option value="" disabled>Select source wallet</option>{serializedWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code} · {formatMoney(wallet.currentBalance, wallet.currency.symbol)}</option>)}</select></label>
              <label className="text-xs text-slate-500">To wallet<select name="toWalletId" required className={`mt-1.5 ${selectClass}`} defaultValue=""><option value="" disabled>Select destination wallet</option>{serializedWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}</select></label>
              <label className="text-xs text-slate-500">Transfer fee <span className="text-slate-600">(optional)</span><input name="feeAmount" type="number" min="0" step="0.01" placeholder="0" className={`mt-1.5 ${inputClass}`} /></label>
              <div className="flex items-end"><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#06110b] transition hover:bg-emerald-400"><ArrowRight size={16} />Transfer Money</button></div>
            </form>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">History</p><h2 className="mt-1 text-base font-semibold text-white">Recent Transfers</h2></div><span className="text-[10px] text-slate-600">Newest first</span></div>
          {serializedTransfers.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0d151e] p-12 text-center"><ArrowLeftRight size={26} className="mx-auto text-slate-600" /><p className="mt-3 text-sm font-semibold text-white">No transfers yet</p><p className="mt-1 text-xs text-slate-500">Your transfer history will appear here after the first transfer.</p></div>
          ) : (
            <div className="space-y-2">{serializedTransfers.map((transfer) => <article key={transfer.id} className="rounded-[18px] border border-white/10 bg-[#0d151e] px-4 py-4 md:px-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-300">TRANSFER</span><span className="text-[10px] text-slate-600"><CalendarDays size={11} className="mr-1 inline" />{formatDate(transfer.transferDate)}</span></div><div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-white">{transfer.fromWallet.name}</span><ArrowRight size={14} className="text-slate-600" /><span className="font-semibold text-white">{transfer.toWallet.name}</span></div></div><div className="flex items-end gap-6 md:text-right"><div><p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Amount</p><p className="mt-0.5 text-sm font-bold text-white">{formatMoney(transfer.amount, transfer.fromWallet.currency.symbol)}</p></div><div><p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Fee</p><p className={`mt-0.5 text-sm font-semibold ${transfer.feeAmount > 0 ? "text-amber-300" : "text-slate-400"}`}>{transfer.feeAmount > 0 ? formatMoney(transfer.feeAmount, transfer.fromWallet.currency.symbol) : "—"}</p></div></div></div></article>)}</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
