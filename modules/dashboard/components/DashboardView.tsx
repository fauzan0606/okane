import type { DashboardData, DashboardPeriod } from "../types";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "THIS_MONTH", label: "This month" },
  { value: "LAST_MONTH", label: "Last month" },
  { value: "THIS_YEAR", label: "This year" },
];

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits:
      currencyCode === "IDR" || currencyCode === "JPY" || currencyCode === "KRW" ? 0 : 2,
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
    <div className="pb-12">
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Overview</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-white">Your money</h1>
          <p className="mt-2 text-sm text-zinc-500">A clear picture of where you stand.</p>
        </div>

        <nav className="flex items-center gap-1 rounded-full bg-zinc-900/80 p-1">
          {periods.map((period) => (
            <a
              key={period.value}
              href={periodHref(period.value, summary.currencyCode)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                data.period === period.value
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {period.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="mb-12">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">Net worth</p>
        <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-5xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            {formatCurrency(summary.netWorth, summary.currencyCode)}
          </p>
          <p className={`text-sm font-medium ${summary.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {summary.netCashFlow >= 0 ? "↑" : "↓"} {formatCurrency(Math.abs(summary.netCashFlow), summary.currencyCode)} net cash flow
          </p>
        </div>
      </section>

      <section className="mb-14 grid grid-cols-2 gap-y-8 border-y border-zinc-900 py-7 md:grid-cols-4 md:gap-0">
        <Stat label="Income" value={formatCurrency(summary.income, summary.currencyCode)} valueClass="text-emerald-400" />
        <Stat label="Expense" value={formatCurrency(summary.expense, summary.currencyCode)} valueClass="text-rose-400" />
        <Stat label="Net cash flow" value={formatCurrency(summary.netCashFlow, summary.currencyCode)} />
        <Stat label="Currency" value={summary.currencyCode} />
      </section>

      <section className="mb-14 grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading eyebrow="Accounts" title="Where your money lives" />
          <div className="mt-6">
            {data.wallets.length === 0 ? (
              <EmptyState message="No active wallets." />
            ) : (
              data.wallets.map((wallet) => (
                <div key={wallet.id} className="group flex items-center justify-between border-b border-zinc-900 py-4 first:border-t">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-zinc-400">
                      {wallet.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-200">{wallet.name}</p>
                      <p className="mt-0.5 text-xs capitalize text-zinc-600">{wallet.walletType.replaceAll("_", " ").toLowerCase()}</p>
                    </div>
                  </div>
                  <p className="ml-4 text-sm font-medium text-zinc-200">{formatCurrency(wallet.balance, wallet.currencyCode)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <SectionHeading eyebrow="Spending" title={`By category · ${data.periodLabel}`} />
          <div className="mt-6 space-y-5">
            {data.spendingByCategory.length === 0 ? (
              <EmptyState message="No expenses in this period." />
            ) : (
              data.spendingByCategory.slice(0, 6).map((category) => (
                <div key={category.id}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-zinc-300">{category.name}</span>
                    <span className="text-sm font-medium text-zinc-400">{formatCurrency(category.amount, summary.currencyCode)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-900">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(category.percentage, 100)}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs text-zinc-600">{category.percentage.toFixed(0)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 border-b border-zinc-900 pb-4">
          <SectionHeading eyebrow="Activity" title="Recent transactions" />
          <a href="/transactions" className="text-xs font-medium text-zinc-500 transition hover:text-white">View all →</a>
        </div>

        <div>
          {data.recentTransactions.length === 0 ? (
            <EmptyState message="No transactions yet." />
          ) : (
            data.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-4 border-b border-zinc-900 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${transaction.type === "INCOME" ? "bg-emerald-400/10 text-emerald-400" : "bg-zinc-900 text-zinc-500"}`}>
                    {transaction.type === "INCOME" ? "↓" : "↑"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">{transaction.payeeName}</p>
                    <p className="truncate text-xs text-zinc-600">{transaction.categoryName} · {transaction.walletName} · {formatDate(transaction.transactionDate)}</p>
                  </div>
                </div>
                <p className={`shrink-0 text-sm font-medium ${transaction.type === "INCOME" ? "text-emerald-400" : "text-zinc-300"}`}>
                  {transaction.type === "INCOME" ? "+" : "−"}{formatCurrency(transaction.amount, summary.currencyCode)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-100">{title}</h2>
    </div>
  );
}

function Stat({ label, value, valueClass = "text-zinc-200" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="md:border-l md:border-zinc-900 md:pl-6 first:md:border-l-0 first:md:pl-0">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className={`mt-2 text-lg font-semibold tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-5 text-sm text-zinc-600">{message}</p>;
}
