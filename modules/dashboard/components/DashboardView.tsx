import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Landmark,
  MoreHorizontal,
  ReceiptText,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { DashboardData, DashboardPeriod } from "../types";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "THIS_YEAR", label: "This Year" },
];

const categoryColors = ["#F59E0B", "#35B779", "#28A9C9", "#8B5CF6", "#94A3B8", "#F97316"];

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits:
      currencyCode === "IDR" || currencyCode === "JPY" || currencyCode === "KRW" ? 0 : 2,
  }).format(value);
}

function formatCompactCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
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
  const maxCashflow = Math.max(...data.cashflow.flatMap((point) => [point.income, point.expense]), 1);

  const donutSegments = data.spendingByCategory.slice(0, 6).reduce<string[]>((segments, category, index) => {
    const previous = segments.length === 0 ? 0 : data.spendingByCategory.slice(0, index).reduce((sum, item) => sum + item.percentage, 0);
    const next = previous + category.percentage;
    segments.push(`${categoryColors[index % categoryColors.length]} ${previous}% ${next}%`);
    return segments;
  }, []);

  const donutStyle = {
    background: donutSegments.length > 0
      ? `conic-gradient(${donutSegments.join(", ")})`
      : "conic-gradient(#e5e7eb 0 100%)",
  };

  return (
    <div className="min-h-full bg-[#fbfaf7] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <header className="mb-7 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-slate-500">Personal Financial Operating System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 md:text-[34px]">
              Good morning, Fauzan! <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">Let&apos;s make today a great financial day.</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative hidden rounded-xl p-2.5 text-slate-500 transition hover:bg-white hover:text-slate-900 md:block" aria-label="Notifications">
              <Bell size={19} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-500" />
            </button>
            <a
              href={periodHref(data.period, summary.currencyCode)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium shadow-sm"
            >
              <CalendarDays size={16} className="text-slate-500" />
              {data.periodLabel}
              <ChevronDown size={15} className="text-slate-400" />
            </a>
          </div>
        </header>

        <section className="relative mb-5 overflow-hidden rounded-[22px] border border-[#f1dfb7] bg-gradient-to-r from-[#fffaf0] via-[#fff8e8] to-[#fffdf8] px-6 py-6 shadow-[0_10px_35px_rgba(246,180,70,0.08)] md:px-8 md:py-7">
          <div className="absolute -right-8 -top-16 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="relative z-10 max-w-[70%] md:max-w-[58%]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CircleDollarSign size={17} className="text-amber-500" />
              Total Balance
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {formatCurrency(summary.netWorth, summary.currencyCode)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Across your active wallets</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 max-w-[330px] flex-1 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" />
              </div>
              <span className="text-xs font-semibold text-emerald-600">Healthy</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Net cash flow this period: <span className={summary.netCashFlow >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-500"}>
                {summary.netCashFlow >= 0 ? "+" : "−"}{formatCurrency(Math.abs(summary.netCashFlow), summary.currencyCode)}
              </span>
            </p>
          </div>
          <div className="absolute bottom-0 right-5 hidden h-[170px] w-[170px] md:block lg:right-10 lg:h-[190px] lg:w-[190px]">
            <Image src="/okane-mascot.svg" alt="OKANE mascot" fill className="object-contain" priority />
          </div>
        </section>

        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={<TrendingUp size={17} />} tone="green" title="Total Income" value={formatCurrency(summary.income, summary.currencyCode)} trend="This period" />
          <SummaryCard icon={<TrendingDown size={17} />} tone="orange" title="Total Expense" value={formatCurrency(summary.expense, summary.currencyCode)} trend="This period" />
          <SummaryCard icon={<ArrowUpRight size={17} />} tone="blue" title="Net Cashflow" value={formatCurrency(summary.netCashFlow, summary.currencyCode)} trend={summary.netCashFlow >= 0 ? "Positive" : "Negative"} />
          <SummaryCard icon={<WalletCards size={17} />} tone="purple" title="Total Assets" value={formatCurrency(summary.netWorth, summary.currencyCode)} trend={`${data.wallets.length} active wallet${data.wallets.length === 1 ? "" : "s"}`} />
        </section>

        <section className="mb-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Money movement</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Cashflow Overview</h2>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Income</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-orange-400" />Expense</span>
              </div>
            </div>

            <div className="mt-7 flex h-52 gap-4">
              <div className="flex flex-col justify-between py-1 text-[10px] text-slate-400">
                <span>{formatCompactCurrency(maxCashflow, summary.currencyCode)}</span>
                <span>{formatCompactCurrency(maxCashflow * 0.66, summary.currencyCode)}</span>
                <span>{formatCompactCurrency(maxCashflow * 0.33, summary.currencyCode)}</span>
                <span>0</span>
              </div>
              <div className="relative flex flex-1 items-end justify-around gap-2 border-b border-slate-100 pb-0 pt-1">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-0">
                  {[0, 1, 2, 3].map((line) => <span key={line} className="border-t border-dashed border-slate-100" />)}
                </div>
                {data.cashflow.map((point) => (
                  <div key={point.label} className="relative z-10 flex h-full flex-1 items-end justify-center gap-1.5">
                    <div className="w-2.5 rounded-t-md bg-emerald-400/85 transition hover:bg-emerald-500" style={{ height: `${Math.max((point.income / maxCashflow) * 88, point.income > 0 ? 4 : 0)}%` }} title={`Income ${formatCurrency(point.income, summary.currencyCode)}`} />
                    <div className="w-2.5 rounded-t-md bg-orange-400/85 transition hover:bg-orange-500" style={{ height: `${Math.max((point.expense / maxCashflow) * 88, point.expense > 0 ? 4 : 0)}%` }} title={`Expense ${formatCurrency(point.expense, summary.currencyCode)}`} />
                    <span className="absolute -bottom-5 whitespace-nowrap text-[10px] text-slate-400">{point.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Where it goes</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Expense by Category</h2>
              </div>
              <MoreHorizontal size={19} className="text-slate-400" />
            </div>

            <div className="mt-5 flex items-center gap-5">
              <div className="relative h-36 w-36 shrink-0 rounded-full" style={donutStyle}>
                <div className="absolute inset-[27%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                  <span className="text-sm font-bold text-slate-800">{formatCompactCurrency(summary.expense, summary.currencyCode)}</span>
                  <span className="mt-0.5 text-[9px] text-slate-400">Total Expense</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {data.spendingByCategory.slice(0, 5).map((category, index) => (
                  <div key={category.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-slate-600">
                      <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} />
                      <span className="truncate">{category.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-slate-700">{category.percentage.toFixed(0)}%</span>
                  </div>
                ))}
                {data.spendingByCategory.length === 0 && <p className="text-sm text-slate-400">No expenses yet.</p>}
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Accounts</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Your Wallets</h2>
              </div>
              <a href="/wallet" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">See all →</a>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {data.wallets.length === 0 ? <EmptyState message="No active wallets." /> : data.wallets.slice(0, 6).map((wallet, index) => (
                <div key={wallet.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index % 3 === 0 ? "bg-blue-50 text-blue-600" : index % 3 === 1 ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"}`}>
                      {wallet.walletType.toLowerCase().includes("bank") ? <Landmark size={17} /> : <CreditCard size={17} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{wallet.name}</p>
                      <p className="truncate text-xs capitalize text-slate-400">{wallet.walletType.replaceAll("_", " ").toLowerCase()}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-800">{formatCurrency(wallet.balance, wallet.currencyCode)}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Latest activity</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Recent Transactions</h2>
              </div>
              <a href="/transactions" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">See all →</a>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {data.recentTransactions.length === 0 ? <EmptyState message="No transactions yet." /> : data.recentTransactions.slice(0, 7).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${transaction.type === "INCOME" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"}`}>
                      {transaction.type === "INCOME" ? <ArrowDownRight size={17} /> : <ReceiptText size={17} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{transaction.payeeName}</p>
                      <p className="truncate text-xs text-slate-400">{transaction.categoryName} · {transaction.walletName} · {formatDate(transaction.transactionDate)}</p>
                    </div>
                  </div>
                  <p className={`shrink-0 text-sm font-bold ${transaction.type === "INCOME" ? "text-emerald-600" : "text-slate-800"}`}>
                    {transaction.type === "INCOME" ? "+" : "−"}{formatCurrency(transaction.amount, summary.currencyCode)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-5 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">OKANE Insight</p>
              <p className="text-xs text-slate-500">Your dashboard is ready for smarter financial insights.</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600">AI insights coming next →</span>
        </section>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)] md:p-6">{children}</section>;
}

function SummaryCard({
  icon,
  tone,
  title,
  value,
  trend,
}: {
  icon: React.ReactNode;
  tone: "green" | "orange" | "blue" | "purple";
  title: string;
  value: string;
  trend: string;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
    blue: "bg-sky-50 text-sky-600",
    purple: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_8px_25px_rgba(15,23,42,0.025)]">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
        <MoreHorizontal size={16} className="text-slate-300" />
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-slate-400">{trend}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-5 text-sm text-slate-400">{message}</p>;
}
