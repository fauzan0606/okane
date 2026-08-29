import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { prisma } from "@/lib/prisma";
import TransferForm from "@/modules/transfer/components/TransferForm";
import TransferCard from "@/modules/transfer/components/TransferCard";
import { ArrowLeftRight, CircleDollarSign, WalletCards } from "lucide-react";

export default async function TransferPage() {
  const [wallets, transfers, investmentCashAccounts] = await Promise.all([
    prisma.wallet.findMany({ where: { isActive: true }, select: { id: true, name: true, walletType: true, currentBalance: true, currency: { select: { code: true, symbol: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.transfer.findMany({
      include: {
        fromWallet: { select: { id: true, name: true, currency: { select: { code: true, symbol: true } } } },
        toWallet: { select: { id: true, name: true, currency: { select: { code: true, symbol: true } } } },
      },
      orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.investmentCashAccount.findMany({ include: { account: { select: { name: true, currency: { select: { code: true } }, provider: { select: { name: true } } } } }, orderBy: { account: { name: "asc" } } }),
  ]);

  const serializedWallets = wallets.map((wallet) => ({ ...wallet, currentBalance: Number(wallet.currentBalance) }));
  const serializedCashAccounts = investmentCashAccounts.map((cash) => ({ id: cash.id, balance: Number(cash.balance), account: { name: cash.account.name, provider: cash.account.provider, currency: cash.account.currency } }));
  const serializedTransfers = transfers.map((transfer) => ({ ...transfer, amount: Number(transfer.amount), feeAmount: Number(transfer.feeAmount), transferDate: transfer.transferDate.toISOString(), createdAt: transfer.createdAt.toISOString(), updatedAt: transfer.updatedAt.toISOString() }));
  const totalTransfers = serializedTransfers.length;
  const totalFees = serializedTransfers.reduce((sum, transfer) => sum + transfer.feeAmount, 0);
  const currencies = new Set(serializedWallets.map((wallet) => wallet.currency.code));

  return <AppShell sidebar={<Sidebar />} header={<Header />}><div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Move money between accounts</p><h1 className="mt-1 text-3xl font-bold text-white">Transfer</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Move money between your own wallets or fund an investment RDN.</p></div><TransferForm wallets={serializedWallets} investmentCashAccounts={serializedCashAccounts} /></div>
    <section className="grid gap-3 md:grid-cols-3"><div className="rounded-[18px] border border-[#30465D] bg-[#172A3D] px-4 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.16)]"><div className="flex items-center gap-2 text-slate-500"><ArrowLeftRight size={14} /><span className="text-[10px] uppercase tracking-[0.12em]">Transfers</span></div><p className="mt-1 text-xl font-semibold text-white">{totalTransfers}</p><p className="mt-1 text-[10px] text-slate-600">Latest 50 transfers</p></div><div className="rounded-[18px] border border-[#30465D] bg-[#172A3D] px-4 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.16)]"><div className="flex items-center gap-2 text-slate-500"><CircleDollarSign size={14} /><span className="text-[10px] uppercase tracking-[0.12em]">Currencies</span></div><p className="mt-1 text-xl font-semibold text-white">{currencies.size}</p><p className="mt-1 text-[10px] text-slate-600">Transfers require matching currencies</p></div><div className="rounded-[18px] border border-[#30465D] bg-[#172A3D] px-4 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.16)]"><div className="flex items-center gap-2 text-slate-500"><WalletCards size={14} /><span className="text-[10px] uppercase tracking-[0.12em]">Recorded fees</span></div><p className="mt-1 text-xl font-semibold text-amber-300">{totalFees === 0 ? "—" : totalFees.toLocaleString("id-ID")}</p><p className="mt-1 text-[10px] text-slate-600">Across displayed transfers</p></div></section>
    <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">History</p><h2 className="mt-1 text-base font-semibold text-white">Recent Transfers</h2></div><span className="text-[10px] text-slate-600">Newest first · manual transfers can be edited or deleted</span></div>{serializedTransfers.length === 0 ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0E1925] p-12 text-center"><ArrowLeftRight size={26} className="mx-auto text-slate-600" /><p className="mt-3 text-sm font-semibold text-white">No transfers yet</p><p className="mt-1 text-xs text-slate-500">Your transfer history will appear here after the first transfer.</p></div> : <div className="space-y-2">{serializedTransfers.map((transfer) => <TransferCard key={transfer.id} transfer={transfer} wallets={serializedWallets} />)}</div>}</section>
  </div></AppShell>;
}
