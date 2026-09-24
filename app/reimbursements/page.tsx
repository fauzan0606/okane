import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { reimburseTransactionAction } from "@/modules/transaction/actions";
import { listReimbursements, transactionFormData } from "@/modules/transaction/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatAmount(value: unknown, symbol: string) {
  return symbol + Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ReimbursementsPage() {
  const [reimbursements, formData] = await Promise.all([listReimbursements(), transactionFormData()]);
  const pending = reimbursements.filter((item) => !item.reimbursementReceipt);
  const completed = reimbursements.filter((item) => item.reimbursementReceipt);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="w-full space-y-6 px-4 py-4 md:px-8 md:py-6">
        <div>
          <h1 className="text-3xl font-bold">Reimbursements</h1>
          <p className="mt-2 text-zinc-500">Track expenses you paid first and record the replacement without counting it as new income.</p>
        </div>
        <section className="rounded-[18px] border border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm text-amber-100">
          <p className="font-semibold">How reimbursement works</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/70">An expense marked “Akan direimburse” reduces your wallet balance as usual. When the money is received, record it here. OKANE records the incoming money as a reimbursement and excludes it from normal income reports.</p>
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Waiting for reimbursement</h2><span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">{pending.length}</span></div>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0d141e] p-6 text-sm text-slate-500">No pending reimbursements.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-[#0d141e] p-4 md:p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-white">{item.payee?.name ?? "Reimbursement expense"}</p><span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Pending</span></div>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(item.transactionDate)} · {item.wallet.name}</p>
                      <p className="mt-3 text-xl font-bold text-amber-200">{formatAmount(item.amount, item.wallet.currency.symbol)}</p>
                      {item.category && <p className="mt-1 text-xs text-slate-500">{item.category.name}{item.subcategory ? " · " + item.subcategory.name : ""}</p>}
                      {item.note && <p className="mt-1 text-xs text-slate-600">{item.note}</p>}
                    </div>
                    <form action={async (formData) => { await reimburseTransactionAction(formData); }} className="grid gap-2 rounded-xl border border-white/10 bg-black/10 p-3 sm:grid-cols-[1fr_1fr_auto] lg:min-w-[520px]">
                      <input type="hidden" name="transactionId" value={item.id} />
                      <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Received date</span><input name="transactionDate" type="date" defaultValue={today} required className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none" /></label>
                      <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Received into</span><select name="walletId" required className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none"><option value="">Select wallet</option>{formData.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label>
                      <button type="submit" className="self-end rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400">Mark reimbursed</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Completed reimbursements</h2><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{completed.length}</span></div>
          {completed.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0d141e] p-6 text-sm text-slate-500">No completed reimbursements yet.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d141e]">
              <div className="divide-y divide-white/5">
                {completed.map((item) => (
                  <div key={item.id} className="grid gap-2 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center md:px-5">
                    <div><p className="font-medium text-white">{item.payee?.name ?? "Reimbursement"}</p><p className="mt-1 text-xs text-slate-500">Expense {formatDate(item.transactionDate)} · Received {formatDate(item.reimbursementReceipt!.transactionDate)} · {item.reimbursementReceipt!.wallet.name}</p></div>
                    <p className="font-semibold text-emerald-300">{formatAmount(item.amount, item.wallet.currency.symbol)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
