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
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">
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

      <div className="mt-6 space-y-1">
        <p className="text-2xl font-bold">
          {transaction.wallet.currency.code}{" "}
          {Number(
            transaction.amount
          ).toLocaleString("id-ID")}
        </p>

        <p className="text-sm text-zinc-500">
          {transaction.wallet.name}
        </p>

        {transaction.payee && (
          <p className="text-sm text-zinc-500">
            {transaction.payee.name}
          </p>
        )}
      </div>
    </div>
  );
}