import type { DashboardData, DashboardPeriod } from "../types";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "THIS_YEAR", label: "This Year" },
];

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: currencyCode === "IDR" || currencyCode === "JPY" || currencyCode === "KRW" ? 0 : 2,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function periodHref(period: DashboardPeriod, currencyCode: string) {
  return `/?period=${period}&currency=${encodeURIComponent(currencyCode)}`;
}

export default function DashboardView({ data }: { data: DashboardData }) {
  const { summary } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-gray-500">Personal Financial Operating System</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {periods.map((period) => (
            <a
              key={period.value}
              href={periodHref(period.value, summary.currencyCode)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                data.period === period.value
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {period.label}
            </a>
          ))}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Net Worth" value={formatCurrency(summary.netWorth, summary.currencyCode)} />
        <Metric title="Income" value={formatCurrency(summary.income, summary.currencyCode)} />
        <Metric title="Expense" value={formatCurrency(summary.expense, summary.currencyCode)} />
        <Metric
          title="Net Cash Flow"
          value={formatCurrency(summary.netCashFlow, summary.currencyCode)}
          valueClass={summary.netCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold">Wallets</h2>
          <div className="mt-5 space-y-4">
            {data.wallets.length === 0 ? (
              <p className="text-sm text-zinc-500">No active wallets.</p>
            ) : (
              data.wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{wallet.name}</p>
                    <p className="text-sm text-zinc-500">{wallet.walletType.replaceAll("_", " ")}</p>
                  </div>
                  <p className="font-medium">
                    {formatCurrency(wallet.balance, wallet.currencyCode)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold">Spending by Category</h2>
          <div className="mt-5 space-y-4">
            {data.spendingByCategory.length === 0 ? (
              <p className="text-sm text-zinc-500">No expenses in this period.</p>
            ) : (
              data.spendingByCategory.slice(0, 6).map((category) => (
                <div key={category.id}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span>{category.name}</span>
                    <span>{formatCurrency(category.amount, summary.currencyCode)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${Math.min(category.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <p className="mt-1 text-sm text-zinc-500">Latest activity in {summary.currencyCode}.</p>
          </div>
          <a href="/transactions" className="text-sm text-zinc-300 hover:text-white">
            View all
          </a>
        </div>

        <div className="mt-5 divide-y divide-zinc-800">
          {data.recentTransactions.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">No transactions yet.</p>
          ) : (
            data.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{transaction.payeeName}</p>
                  <p className="text-sm text-zinc-500">
                    {transaction.categoryName} · {transaction.walletName} · {formatDate(transaction.transactionDate)}
                  </p>
                </div>
                <p className={transaction.type === "INCOME" ? "font-medium text-emerald-400" : "font-medium text-red-400"}>
                  {transaction.type === "INCOME" ? "+" : "-"}
                  {formatCurrency(transaction.amount, summary.currencyCode)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
  valueClass = "text-white",
}: {
  title: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className={`mt-3 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
