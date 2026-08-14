import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import { Button } from "@/components/ui/button";

import TransactionForm from "@/modules/transaction/components/TransactionForm";
import TransactionImport from "@/modules/transaction/components/TransactionImport";
import TransactionList from "@/modules/transaction/components/TransactionList";

import {
  listTransactions,
  transactionFormData,
} from "@/modules/transaction/service";
import { IMPORT_REVIEW_WALLET_NAME } from "@/modules/transaction/importReview";
import type { TransactionWithRelations } from "@/modules/transaction/repository";
import type { Category, Payee, Subcategory } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClientTransaction = TransactionWithRelations;
type ClientCategory = Pick<Category, "id" | "name" | "type" | "icon" | "color">;
type ClientSubcategory = Pick<Subcategory, "id" | "categoryId" | "name" | "isActive" | "sortOrder">;
type ClientPayee = Pick<Payee, "id" | "name" | "note">;

type ClientTransactionFormData = {
  wallets: Awaited<ReturnType<typeof transactionFormData>>["wallets"];
  categories: ClientCategory[];
  subcategories: ClientSubcategory[];
  payees: ClientPayee[];
};

function serializeTransactionList(transactions: TransactionWithRelations[]): ClientTransaction[] {
  return transactions.map((transaction) => ({
    ...transaction,
    transactionDate: String(transaction.transactionDate),
    amount: String(transaction.amount),
    note: transaction.note ?? null,
    walletId: String(transaction.walletId),
    categoryId: transaction.categoryId ? String(transaction.categoryId) : null,
    subcategoryId: transaction.subcategoryId ? String(transaction.subcategoryId) : null,
    payeeId: transaction.payeeId ? String(transaction.payeeId) : null,
    installmentPlan: transaction.installmentPlan
      ? {
          ...transaction.installmentPlan,
          totalAmount: String(transaction.installmentPlan.totalAmount),
          feeAmount: String(transaction.installmentPlan.feeAmount),
          installmentAmount: String(transaction.installmentPlan.installmentAmount),
          startDate: String(transaction.installmentPlan.startDate),
        }
      : null,
  }));
}

function serializeFormData(formData: Awaited<ReturnType<typeof transactionFormData>>): ClientTransactionFormData {
  return {
    wallets: formData.wallets.map((wallet) => ({
      id: String(wallet.id),
      name: String(wallet.name),
      walletType: wallet.walletType,
    })),
    categories: formData.categories.map((category) => ({
      id: String(category.id),
      name: String(category.name),
      type: category.type,
      icon: category.icon ?? null,
      color: category.color ?? null,
    })),
    subcategories: formData.subcategories.map((subcategory) => ({
      id: String(subcategory.id),
      categoryId: String(subcategory.categoryId),
      name: String(subcategory.name),
      isActive: Boolean(subcategory.isActive),
      sortOrder: Number(subcategory.sortOrder),
    })),
    payees: formData.payees.map((payee) => ({
      id: String(payee.id),
      name: String(payee.name),
      note: payee.note ?? null,
    })),
  };
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; wallet?: string; from?: string; to?: string; review?: string }>;
}) {
  const [transactions, rawFormData, params] = await Promise.all([
    listTransactions(),
    transactionFormData(),
    searchParams,
  ]);

  const formData = serializeFormData(rawFormData);
  const clientTransactions = serializeTransactionList(transactions);

  const categoryId = params.category ?? "";
  const walletId = params.wallet ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const reviewOnly = params.review === "1";

  const incompleteTransactions = clientTransactions.filter((transaction) =>
    transaction.wallet.name === IMPORT_REVIEW_WALLET_NAME || !transaction.categoryId || !transaction.subcategoryId,
  );

  const filteredTransactions = (reviewOnly ? incompleteTransactions : clientTransactions).filter((transaction) => {
    const transactionDay = transaction.transactionDate.slice(0, 10);
    if (categoryId && transaction.categoryId !== categoryId) return false;
    if (walletId && transaction.walletId !== walletId) return false;
    if (from && transactionDay < from) return false;
    if (to && transactionDay > to) return false;
    return true;
  });

  const hasFilters = Boolean(categoryId || walletId || from || to || reviewOnly);

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="mt-2 text-zinc-500">Record income and expenses.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {incompleteTransactions.length > 0 && (
              <a href="/transactions?review=1" className="inline-flex items-center rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-400/[0.1]">
                Review incomplete ({incompleteTransactions.length})
              </a>
            )}
            <TransactionImport wallets={formData.wallets} categories={formData.categories} subcategories={formData.subcategories} />
            <TransactionForm
              mode="create"
              wallets={formData.wallets}
              categories={formData.categories}
              subcategories={formData.subcategories}
              payees={formData.payees}
              trigger={<Button size="lg">+ Add Transaction</Button>}
            />
          </div>
        </div>

        {reviewOnly && (
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm text-amber-100 md:flex-row md:items-center md:justify-between">
            <span>Showing {filteredTransactions.length} incomplete transactions. Complete missing wallet, category, or subcategory fields and the transaction will leave this review view.</span>
            <a href="/transactions" className="font-semibold underline underline-offset-2">Show all transactions</a>
          </div>
        )}

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
            <span>Showing {filteredTransactions.length} of {clientTransactions.length} transactions</span>
          </div>
        )}

        <TransactionList
          transactions={filteredTransactions}
          wallets={formData.wallets}
          categories={formData.categories}
          subcategories={formData.subcategories}
          payees={formData.payees}
        />
      </div>
    </AppShell>
  );
}
