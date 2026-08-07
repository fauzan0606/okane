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

export default async function TransactionsPage() {
  const [
    transactions,
    formData,
  ] = await Promise.all([
    listTransactions(),
    transactionFormData(),
  ]);

  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Transactions
            </h1>

            <p className="mt-2 text-zinc-500">
              Record income and expenses.
            </p>
          </div>

          <TransactionForm
            mode="create"
            wallets={formData.wallets}
            categories={formData.categories}
            payees={formData.payees}
            trigger={
              <Button size="lg">
                + Add Transaction
              </Button>
            }
          />
        </div>

        <TransactionList
          transactions={transactions}
        />
      </div>
    </AppShell>
  );
}