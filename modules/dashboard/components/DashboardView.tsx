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
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-7 shadow-2xl md:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium tracking-wide text-emerald-400">YOUR MONEY AT A GLANCE</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Good to see you.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              A simple view of your financial position, cash flow, and latest activity.
            </p>
          </div>

          <div className="flex w-fit rounded-xl border border-zinc-800 bg-black/40 p-1 backdrop-blur">
            {periods.map((period) => (
              <a
                key={period.value}
                href={periodHref(period.value, summary.currencyCode)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition md:text-sm ${
                  data.period === period.value
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {period.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Net worth" value={formatCurrency(summary.netWorth, summary.currencyCode)} featured />
        <Metric title="Income" value={formatCurrency(summary.income, summary.currencyCode)} valueClass="text-emerald-400" />
        <Metric title="Expense" value={formatCurrency(summary.expense, summary.currencyCode)} valueClass="text-rose-400" />
        <Metric
          title="Net cash flow"
          value={`${summary.netCashFlow >= 0 ? "+" : ""}${formatCurrency(summary.netCashFlow, summary.currencyCode)}`}
          valueClass={summary.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Wallets" eyebrow="CURRENT BALANCES">
          <div className="space-y-2">
            {data.wallets.length === 0 ? (
              <EmptyState message="No active wallets." />
            ) : (
              data.wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="group flex items-center justify-between rounded-2xl px-3 py-3 transition hover:bg-zinc-900/80"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm text-zinc-300 ring-1 ring-zinc-800">
                      {wallet.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">{wallet.name}</p>
                      <p className="mt-0.5 text-xs capitalize text-zinc-500">{wallet.walletType.replaceAll("_", " ").toLowerCase()}</p>
                    </div>
                  </div>
                  <p className="ml-4 font-semibold text-zinc-100">
                    {formatCurrency(wallet.balance, wallet.currencyCode)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Spending by category" eyebrow={data.periodLabel.toUpperCase()}>
          <div className="space-y-5">
            {data.spendingByCategory.length === 0 ? (
              <EmptyState message="No expenses in this period." />
            ) : (
              data.spendingByCategory.slice(0, 6).map((category) => (
                <div key={category.id}>
                  <div className="flex items-end justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-zinc-200">{category.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{category.percentage.toFixed(0)}% of spending</p>
                    </div>
                    <span className="font-medium text-zinc-200">{formatCurrency(category.amount, summary.currencyCode)}</span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all"
                      style={{ width: `${Math.min(category.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel
        title="Recent transactions"
        eyebrow="LATEST ACTIVITY"
        action={
          <a href="/transactions" className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-white">
            View all →
          </a>
        }
      >
        <div className="divide-y divide-zinc-900">
          {data.recentTransactions.length === 0 ? (
            <EmptyState message="No transactions yet." />
          ) : (
            data.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                      transaction.type === "INCOME"
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-rose-400/10 text-rose-400"
                    }`}
                  >
                    {transaction.type === "INCOME" ? "↓" : "↑"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{transaction.payeeName}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {transaction.categoryName} · {transaction.walletName} · {formatDate(transaction.transactionDate)}
                    </p>
                  </div>
                </div>
                <p className={`shrink-0 text-sm font-semibold ${transaction.type === "INCOME" ? "text-emerald-400" : "text-zinc-200"}`}>
                  {transaction.type === "INCOME" ? "+" : "−"}
                  {formatCurrency(transaction.amount, summary.currencyCode)}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-zinc-800 bg-zinc-950/70 p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-600">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({
  title,
  value,
  valueClass = "text-zinc-100",
  featured = false,
}: {
  title: string;
  value: string;
  valueClass?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] border p-5 transition hover:-translate-y-0.5 ${
        featured
          ? "border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 via-zinc-950 to-zinc-950"
          : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
      }`}
    >
      {featured && <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />}
      <p className="relative text-xs font-medium text-zinc-500">{title}</p>
      <p className={`relative mt-3 truncate text-xl font-semibold tracking-tight md:text-2xl ${valueClass}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-xl bg-zinc-900/50 px-4 py-5 text-sm text-zinc-500">{message}</p>;
}
