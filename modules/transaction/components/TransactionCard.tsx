import type { TransactionWithRelations } from "../repository";

import {
  formatTransactionType,
} from "../constants";

import TransactionCardActions from "./TransactionCardActions";

type TransactionCardProps = {
  transaction: TransactionWithRelations;
};

export default function TransactionCard({
  transaction,
}: TransactionCardProps) {
  const amount = Number(transaction.amount);

  const amountColor =
    transaction.type === "EXPENSE"
      ? "text-red-600"
      : "text-emerald-600";

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">
            {transaction.category?.name ??
              "Uncategorized"}
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            {formatTransactionType(
              transaction.type
            )}
          </p>
        </div>

        <TransactionCardActions
          transaction={transaction}
        />
      </div>

      <div className="mt-6">
        <p
          className={`text-2xl font-bold ${amountColor}`}
        >
          {transaction.wallet.currency.code}{" "}
          {amount.toLocaleString("id-ID")}
        </p>

        <div className="mt-2 space-y-1 text-sm text-zinc-500">
          <p>
            Wallet: {transaction.wallet.name}
          </p>

          {transaction.payee && (
            <p>
              Merchant: {transaction.payee.name}
            </p>
          )}

          <p>
            {new Date(
              transaction.transactionDate
            ).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}