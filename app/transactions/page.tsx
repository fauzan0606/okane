import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import { Button } from "@/components/ui/button";

import TransactionForm from "@/modules/transaction/components/TransactionForm";
import TransactionList from "@/modules/transaction/components/TransactionList";

import {
  listTransactions,
  transactionFormData,
} from "@/modules/transaction/service";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; wallet?: string; from?: string; to?: string }>;
}) {
  const [transactions, formData, params] = await Promise.all([
    listTransactions(),
    transactionFormData(),
    searchParams,
  ]);

  const categoryId = params.category ?? "";
  const walletId = params.wallet ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";

  const filteredTransactions = transactions.filter((transaction) => {
    const transactionDay = transaction.transactionDate.slice(0, 10);
    if (categoryId && transaction.categoryId !== categoryId) return false;
    if (walletId && transaction.walletId !== walletId) return false;
    if (from && transactionDay < from) return false;
    if (to && transactionDay > to) return false;
    return true;
  });

  const hasFilters = Boolean(categoryId || walletId || from || to);

  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="mt-2 text-zinc-500">Record income and expenses.</p>
          </div>

          <TransactionForm
            mode="create"
            wallets={formData.wallets}
            categories={formData.categories}
            payees={formData.payees}
            trigger={<Button size="lg">+ Add Transaction</Button>}
          />
        </div>

        <section className="rounded-[18px] border border-white/10 bg-[#0d141e] p-4">
          <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Category</span>
              <select name="category" defaultValue={categoryId} className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none">
                <option value="">All categories</option>
                {formData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Wallet</span>
              <select name="wallet" defaultValue={walletId} className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none">
                <option value="">All wallets</option>
                {formData.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">From date</span>
              <input name="from" type="date" defaultValue={from} className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">To date</span>
              <input name="to" type="date" defaultValue={to} className="w-full rounded-xl border border-white/10 bg-[#070c12] px-3 py-2.5 text-sm text-slate-300 outline-none" />
            </label>

            <div className="flex gap-2">
              <Button type="submit" className="w-full md:w-auto">Filter</Button>
              {hasFilters && <a href="/transactions" className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.04]">Clear</a>}
            </div>
          </form>
        </section>

        {hasFilters && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
          </div>
        )}

        <TransactionList
          transactions={filteredTransactions}
          wallets={formData.wallets}
          categories={formData.categories}
          payees={formData.payees}
        />
      </div>
    </AppShell>
  );
}
