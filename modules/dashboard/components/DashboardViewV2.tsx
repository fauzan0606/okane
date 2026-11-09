import { Suspense } from "react";
import { ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, CreditCard, Landmark, MoreHorizontal, ReceiptText, Sparkles, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { DashboardData, DashboardPeriod } from "../types";
import CreditCardSummary from "./CreditCardSummary";
import DashboardMonthlyCalendar from "./DashboardMonthlyCalendar";
import ReceivableSummary from "@/modules/receivable/components/ReceivableSummary";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "THIS_YEAR", label: "This Year" },
];
const categoryColors = ["#F5A623", "#43B96D", "#28A9C5", "#8B62D9", "#A8AFB8", "#F97316"];

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "IDR" || currencyCode === "JPY" || currencyCode === "KRW" ? 0 : 2 }).format(value);
}
function formatCompactCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: currencyCode, notation: "compact", maximumFractionDigits: 1 }).format(value);
}
function formatDate(value: Date) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(value); }
function periodHref(period: DashboardPeriod, currencyCode: string) { return `/?period=${period}&currency=${encodeURIComponent(currencyCode)}`; }

export default function DashboardViewV2({ data }: { data: DashboardData }) {
  const { summary, budget, aiAssessment, calendar } = data;
  const localHour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()));
  const greeting = localHour < 12 ? "Good morning" : localHour < 18 ? "Good afternoon" : "Good evening";
  const donutSegments = data.spendingByCategory.slice(0, 6).reduce<string[]>((segments, category, index) => {
    const previous = data.spendingByCategory.slice(0, index).reduce((sum, item) => sum + item.percentage, 0);
    segments.push(`${categoryColors[index % categoryColors.length]} ${previous}% ${previous + category.percentage}%`);
    return segments;
  }, []);
  const donutStyle = { background: donutSegments.length > 0 ? `conic-gradient(${donutSegments.join(", ")})` : "conic-gradient(#273244 0 100%)" };

  return (
    <div className="min-h-screen bg-[#070c12] text-slate-100">
      <div className="mx-auto max-w-[1480px] px-4 py-5 pb-28 sm:px-5 sm:py-6 md:px-8 md:py-8 md:pb-8 xl:px-10">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Personal Financial Operating System</p>
            <h1 className="mt-2 text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[32px] md:text-[34px]">{greeting}, Fauzan! <span aria-hidden>👋</span></h1>
            <p className="mt-2 max-w-[34rem] text-sm leading-6 text-slate-400">Let&apos;s make today a great financial day.</p>
          </div>
          <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end">
            <button type="button" aria-label="Notifications" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/5 hover:text-white"><Bell size={21} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" /></button>
            <div className="relative group">
              <a href={periodHref(data.period, summary.currencyCode)} className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0d141e] px-3.5 text-xs font-semibold text-slate-200"><CalendarDays size={15} className="text-slate-400" />{data.periodLabel}<ChevronDown size={14} className="text-slate-500" /></a>
              <div className="absolute right-0 z-30 mt-2 hidden w-36 overflow-hidden rounded-xl border border-white/10 bg-[#111923] p-1 shadow-2xl group-hover:block">{periods.map((period) => <a key={period.value} href={periodHref(period.value, summary.currencyCode)} className="block rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white">{period.label}</a>)}</div>
            </div>
          </div>
        </header>

        <section className="mb-5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-4"><SummaryCard icon={<TrendingUp size={18} />} tone="green" title="Total Income" value={formatCurrency(summary.income, summary.currencyCode)} detail={data.periodLabel} /><SummaryCard icon={<TrendingDown size={18} />} tone="orange" title="Total Expense" value={formatCurrency(summary.expense, summary.currencyCode)} detail={data.periodLabel} /><SummaryCard icon={<ArrowUpRight size={18} />} tone="blue" title="Net Cashflow" value={formatCurrency(summary.netCashFlow, summary.currencyCode)} detail={summary.netCashFlow >= 0 ? "Positive cash flow" : "Negative cash flow"} /><SummaryCard icon={<WalletCards size={18} />} tone="purple" title="Total Assets" value={formatCurrency(summary.netWorth, summary.currencyCode)} detail={`${data.wallets.length} active wallet${data.wallets.length === 1 ? "" : "s"}`} /></section>

        <section className="mb-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <DarkPanel><PanelHeading eyebrow="Monthly budget" title="Budget progress" />{budget.hasBudget ? <><p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{formatCurrency(budget.totalBudget, summary.currencyCode)}</p><p className="mt-1 text-xs text-slate-400">{formatCurrency(budget.actualUsed, summary.currencyCode)} used · {formatCurrency(Math.max(budget.remaining, 0), summary.currencyCode)} remaining</p><div className="mt-5 flex items-center gap-3"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${budget.progressPercentage >= 100 ? "bg-red-400" : budget.progressPercentage >= 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${budget.progressPercentage}%` }} /></div><span className={`text-xs font-semibold ${budget.progressPercentage >= 100 ? "text-red-300" : budget.progressPercentage >= 80 ? "text-amber-300" : "text-emerald-400"}`}>{Math.round(budget.progressPercentage)}%</span></div><p className="mt-2 text-[10px] text-slate-500">Actual spending vs monthly budget · {budget.mode === "OVERALL" ? "overall" : "per category"}</p></> : <><p className="mt-4 text-xl font-semibold leading-tight text-white">No budget set for this month</p><p className="mt-1 text-sm leading-6 text-slate-400">Set a monthly budget to see spending progress here.</p><a href="/budget" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b]">Create budget →</a></>}</DarkPanel>
          <DarkPanel><PanelHeading eyebrow="Where it goes" title="Spending by Category"><MoreHorizontal size={18} className="text-slate-500" /></PanelHeading><div className="mt-4 flex items-center gap-4"><div className="relative h-[118px] w-[118px] shrink-0 rounded-full" style={donutStyle}><div className="absolute inset-[27%] flex flex-col items-center justify-center rounded-full bg-[#111923] text-center"><span className="text-[11px] font-bold text-white">{formatCompactCurrency(summary.expense, summary.currencyCode)}</span><span className="mt-0.5 text-[8px] text-slate-500">Total Expense</span></div></div><div className="min-w-0 flex-1 space-y-2.5">{data.spendingByCategory.slice(0, 5).map((category, index) => <div key={category.id} className="flex items-center justify-between gap-2 text-[10px]"><span className="flex min-w-0 items-center gap-1.5 text-slate-300"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} /><span className="truncate">{category.name}</span></span><span className="shrink-0 font-semibold text-slate-200">{category.percentage.toFixed(0)}%</span></div>)}{data.spendingByCategory.length === 0 && <p className="text-xs text-slate-500">No expenses yet.</p>}</div></div>{data.spendingByCategory.length > 0 && <a href="/transactions" className="mt-3 block text-right text-[10px] font-semibold text-emerald-400 hover:text-emerald-300">View transactions →</a>}</DarkPanel>
          <DarkPanel><PanelHeading eyebrow="AI financial assessment" title="How is my financial condition?"><Sparkles size={18} className="text-emerald-400" /></PanelHeading><div className="mt-4 flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-8 border-white/5" style={{ background: `conic-gradient(#34d399 ${aiAssessment.score * 3.6}deg, #172231 0)` }}><div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#111923]"><span className="text-lg font-bold text-white">{aiAssessment.score}</span></div></div><div className="min-w-0"><p className={`text-sm font-semibold ${aiAssessment.status === "HEALTHY" ? "text-emerald-300" : aiAssessment.status === "WATCH" ? "text-amber-300" : "text-red-300"}`}>{aiAssessment.status === "HEALTHY" ? "Healthy" : aiAssessment.status === "WATCH" ? "Watch" : "At risk"}</p><p className="mt-1 text-xs text-slate-300">{aiAssessment.headline}</p></div></div><div className="mt-3 space-y-1.5">{aiAssessment.insights.map((insight) => <div key={insight} className="rounded-lg border border-white/5 bg-[#0d151e] px-2.5 py-2 text-[10px] text-slate-400">{insight}</div>)}</div><p className="mt-2 text-[9px] text-slate-600">Based on income, spending, budget usage and unbudgeted spending.</p></DarkPanel>
        </section>

        <section className="mb-5 grid gap-5 lg:grid-cols-2"><DashboardMonthlyCalendar calendar={calendar} currencyCode={summary.currencyCode} /><MoneyMovementChart calendar={calendar} budget={budget} currencyCode={summary.currencyCode} /></section>

        <Suspense fallback={null}><CreditCardSummary /></Suspense>
        <Suspense fallback={null}><ReceivableSummary /></Suspense>

        <section className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]"><DarkPanel><PanelHeading eyebrow="Accounts" title="Your Wallets"><a href="/wallet" className="text-[11px] font-semibold text-emerald-400">See all →</a></PanelHeading><div className="mt-4 divide-y divide-white/5">{data.wallets.slice(0, 6).map((wallet, index) => <div key={wallet.id} className="flex items-center justify-between gap-4 py-3.5"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${index % 2 ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}>{wallet.walletType.toLowerCase().includes("bank") ? <Landmark size={17} /> : <CreditCard size={17} />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{wallet.name}</p><p className="truncate text-xs capitalize text-slate-500">{wallet.walletType.replaceAll("_", " ").toLowerCase()}</p></div></div><p className="shrink-0 text-sm font-semibold text-slate-200">{formatCurrency(wallet.balance, wallet.currencyCode)}</p></div>)}</div></DarkPanel><DarkPanel><PanelHeading eyebrow="Latest activity" title="Recent Transactions"><a href="/transactions" className="text-[11px] font-semibold text-emerald-400">See all →</a></PanelHeading><div className="mt-4 divide-y divide-white/5">{data.recentTransactions.slice(0, 7).map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-4 py-3.5"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${transaction.type === "INCOME" ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500/15 text-orange-400"}`}>{transaction.type === "INCOME" ? <ArrowDownRight size={17} /> : <ReceiptText size={17} />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{transaction.payeeName}</p><p className="truncate text-xs text-slate-500">{transaction.categoryName} · {transaction.walletName}</p></div></div><div className="shrink-0 text-right"><p className={`text-sm font-semibold ${transaction.type === "INCOME" ? "text-emerald-400" : "text-red-400"}`}>{transaction.type === "INCOME" ? "+" : "−"}{formatCurrency(transaction.amount, summary.currencyCode)}</p><p className="text-[10px] text-slate-600">{formatDate(transaction.transactionDate)}</p></div></div>)}</div></DarkPanel></section>

        <section className="mt-5 flex flex-col gap-4 rounded-[20px] border border-white/10 bg-[#0d151e] px-6 py-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10"><Sparkles size={18} className="text-emerald-400" /></div><div><p className="text-sm font-semibold text-slate-200">Take control anywhere</p><p className="text-xs text-slate-500">Add a transaction instantly with OKANE Smart Transaction.</p></div></div><a href="/transactions/smart" className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b]">Add with Smart Transaction →</a></section>

        <a href="/transactions/smart" className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-[#07110b] shadow-[0_12px_30px_rgba(0,0,0,0.35)] sm:right-5 md:hidden"><Sparkles size={17} /> <span>Smart Transaction</span></a>
      </div>
    </div>
  );
}

function MoneyMovementChart({ calendar, budget, currencyCode }: { calendar: DashboardData["calendar"]; budget: DashboardData["budget"]; currencyCode: string }) {
  const dayCount = calendar.days.length;
  const currentDay = calendar.days.find((day) => day.isToday)?.day ?? dayCount;
  const hasTarget = budget.hasBudget && budget.totalBudget > 0;
  const points = calendar.days.reduce<Array<{ day: number; target: number | null; actual: number | null }>>((accumulated, day) => {
    const actual = day.day <= currentDay ? (accumulated[accumulated.length - 1]?.actual ?? 0) + day.expense : null;
    return [...accumulated, {
      day: day.day,
      target: hasTarget ? budget.totalBudget * day.day / dayCount : null,
      actual,
    }];
  }, []);
  const actualToDate = points.find((point) => point.day === currentDay)?.actual ?? 0;
  const targetToDate = hasTarget ? budget.totalBudget * currentDay / dayCount : 0;
  const difference = actualToDate - targetToDate;
  const maximum = Math.max(hasTarget ? budget.totalBudget : 0, actualToDate, 1);
  const width = 680;
  const height = 270;
  const left = 72;
  const right = 664;
  const top = 20;
  const bottom = 226;
  const x = (day: number) => left + ((day - 1) / Math.max(dayCount - 1, 1)) * (right - left);
  const y = (value: number) => bottom - (value / maximum) * (bottom - top);
  const toPath = (key: "target" | "actual") => points.flatMap((point) => point[key] === null ? [] : [`${x(point.day)},${y(point[key] as number)}`]).join(" ");
  const xTicks = [...new Set([1, 5, 10, 15, 20, 25, dayCount])].filter((day) => day <= dayCount);

  return (
    <DarkPanel>
      <PanelHeading eyebrow={`Money movement · ${calendar.label}`} title="Pengeluaran vs budget">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[10px] text-slate-400">
          {hasTarget && <span className="flex items-center gap-1.5"><i className="w-3 border-t-2 border-dashed border-blue-400" />Target rata-rata</span>}
          <span className="flex items-center gap-1.5"><i className="w-3 border-t-2 border-orange-400" />Aktual kumulatif</span>
        </div>
      </PanelHeading>
      <p className="mt-3 text-[11px] text-slate-400">
        {hasTarget
          ? <>Sampai tanggal {currentDay}: aktual <span className="font-semibold text-orange-300">{formatCurrency(actualToDate, currencyCode)}</span>, target rata-rata {formatCurrency(targetToDate, currencyCode)}. <span className={`font-semibold ${difference > 0 ? "text-red-300" : "text-emerald-300"}`}>{difference > 0 ? `${formatCurrency(difference, currencyCode)} di atas target` : `${formatCurrency(Math.abs(difference), currencyCode)} di bawah target`}</span>.</>
          : <>Belum ada budget untuk {calendar.label}; grafik menampilkan akumulasi pengeluaran aktual.</>}
      </p>
      <div className="mt-3 w-full overflow-hidden">
        {dayCount > 0 ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="money-movement-title money-movement-description" className="h-auto w-full overflow-visible">
          <title id="money-movement-title">Pengeluaran kumulatif dibanding target budget {calendar.label}</title>
          <desc id="money-movement-description">Garis biru putus-putus adalah target budget yang naik rata sampai akhir bulan. Garis oranye adalah pengeluaran aktual yang terakumulasi sampai hari ini.</desc>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const value = maximum * fraction;
            const yPosition = y(value);
            return <g key={fraction}>
              <line x1={left} y1={yPosition} x2={right} y2={yPosition} stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
              <text x={left - 8} y={yPosition + 4} textAnchor="end" className="fill-slate-500 text-[10px]">{formatCompactCurrency(value, currencyCode)}</text>
            </g>;
          })}
          <line x1={x(currentDay)} y1={top} x2={x(currentDay)} y2={bottom} stroke="rgba(148,163,184,0.3)" strokeWidth="1" strokeDasharray="3 5" />
          {hasTarget && <polyline points={toPath("target")} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />}
          <polyline points={toPath("actual")} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.filter((point) => point.actual !== null).map((point) => <circle key={`actual-${point.day}`} cx={x(point.day)} cy={y(point.actual as number)} r={point.day === currentDay ? 4 : 2.5} fill="#fb923c"><title>{`Tanggal ${point.day}: pengeluaran kumulatif ${formatCurrency(point.actual as number, currencyCode)}`}</title></circle>)}
          {xTicks.map((day) => <text key={`tick-${day}`} x={x(day)} y={bottom + 22} textAnchor="middle" className="fill-slate-500 text-[10px]">{day}</text>)}
          <text x={x(currentDay)} y={top - 4} textAnchor="middle" className="fill-slate-400 text-[9px]">Hari ini</text>
        </svg> : <p className="py-12 text-center text-sm text-slate-500">Tidak ada data harian.</p>}
      </div>
      <div className="mt-1 flex justify-between pl-[72px] text-[9px] text-slate-600"><span>Tanggal</span><span>{calendar.label}</span></div>
    </DarkPanel>
  );
}
function PanelHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{title}</h2></div>{children}</div>; }
function DarkPanel({ children }: { children: React.ReactNode }) { return <section className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5 md:p-6">{children}</section>; }
function EmptyState({ message }: { message: string }) { return <p className="py-8 text-center text-sm text-slate-500">{message}</p>; }
function SummaryCard({ icon, tone, title, value, detail }: { icon: React.ReactNode; tone: "green" | "orange" | "blue" | "purple"; title: string; value: string; detail: string }) { const toneClass = { green: "bg-emerald-500/10 text-emerald-400", orange: "bg-orange-500/10 text-orange-400", blue: "bg-blue-500/10 text-blue-400", purple: "bg-violet-500/10 text-violet-400" }[tone]; return <div className="rounded-[18px] border border-white/10 bg-[#0d151e] px-4 py-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{title}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p><p className="mt-1 text-[10px] text-slate-600">{detail}</p></div>; }
