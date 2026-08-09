import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { ensureStatement, getCreditCardStatements, getStatementForecast } from "@/modules/credit-card/service";
import CreditCardAccountCard from "@/modules/credit-card/components/CreditCardAccountCard";
import type { CreditCardStatementView } from "@/modules/credit-card/components/CreditCardStatementCard";

type CardData = {
  wallet: { id: string; name: string; currencySymbol: string; creditLimit: string; billingDate: number; dueDay: number };
  statements: CreditCardStatementView[];
  forecast: { amount: number; periodStart: string; statementDate: string; dueDate: string } | null;
  status: CreditCardStatementView["status"];
  dueDate: string | null;
  remaining: number;
  priority: number;
};

function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime(); }
function daysUntil(value: string | null) { return value ? Math.round((startOfDay(new Date(value)) - startOfDay(new Date())) / 86400000) : null; }

function priority(status: CreditCardStatementView["status"], dueDate: string | null) {
  const days = daysUntil(dueDate);
  if (status === "OVERDUE") return 0;
  if (status !== "PAID" && days !== null && days <= 7) return 1;
  if (status === "PARTIALLY_PAID") return 2;
  if (status === "UNPAID") return 3;
  if (status === "PAID" && days !== null && days < 0) return 5;
  return 4;
}

export default async function CreditCardPage() {
  const cards = await prisma.wallet.findMany({ where: { isActive: true, walletType: "CREDIT_CARD" }, include: { currency: true, creditCard: true }, orderBy: { name: "asc" } });

  const rawData: Array<CardData | null> = await Promise.all(cards.map(async (wallet) => {
    if (!wallet.creditCard) return null;
    await ensureStatement(wallet.id);
    const [statements, forecast] = await Promise.all([getCreditCardStatements(wallet.id), getStatementForecast(wallet.id)]);
    const serializedStatements: CreditCardStatementView[] = statements.map((statement) => ({
      id: statement.id,
      creditCardId: statement.creditCardId,
      periodStart: statement.periodStart.toISOString(),
      periodEnd: statement.periodEnd.toISOString(),
      statementDate: statement.statementDate.toISOString(),
      dueDate: statement.dueDate.toISOString(),
      calculatedAmount: statement.calculatedAmount.toString(),
      actualAmount: statement.actualAmount?.toString() ?? null,
      paidAmount: statement.paidAmount.toString(),
      paidAt: statement.paidAt?.toISOString() ?? null,
      status: statement.status,
      createdAt: statement.createdAt.toISOString(),
      updatedAt: statement.updatedAt.toISOString(),
    }));

    const current = serializedStatements.find((statement) => statement.status !== "PAID") ?? serializedStatements[0] ?? null;
    const target = current ? Number(current.actualAmount ?? current.calculatedAmount) : 0;
    const paid = current ? Number(current.paidAmount) : 0;
    const remaining = Math.max(target - paid, 0);
    const status = current?.status ?? "UNPAID";
    const dueDate = current?.dueDate ?? forecast?.dueDate.toISOString() ?? null;

    return {
      wallet: { id: wallet.id, name: wallet.name, currencySymbol: wallet.currency.symbol, creditLimit: wallet.creditCard.creditLimit.toString(), billingDate: wallet.creditCard.billingDate, dueDay: wallet.creditCard.dueDate },
      statements: serializedStatements,
      forecast: forecast ? { amount: forecast.amount, periodStart: forecast.periodStart.toISOString(), statementDate: forecast.statementDate.toISOString(), dueDate: forecast.dueDate.toISOString() } : null,
      status,
      dueDate,
      remaining,
      priority: priority(status, dueDate),
    } satisfies CardData;
  }));

  const data = rawData.filter((item): item is CardData => item !== null).sort((a, b) => a.priority - b.priority || (daysUntil(a.dueDate) ?? 9999) - (daysUntil(b.dueDate) ?? 9999));
  const overdueCount = data.filter((card) => card.status === "OVERDUE").length;
  const dueSoonCount = data.filter((card) => card.status !== "PAID" && (daysUntil(card.dueDate) ?? 999) >= 0 && (daysUntil(card.dueDate) ?? 999) <= 7).length;
  const totalOutstanding = data.reduce((sum, card) => sum + card.remaining, 0);

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold text-white">Credit Cards</h1><p className="mt-2 text-slate-500">Monitor outstanding bills, due dates, payments, and estimated statements.</p></div>

        {data.length === 0 ? <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0E151E] p-12 text-center"><p className="text-lg font-semibold text-white">No credit card wallets</p><p className="mt-2 text-sm text-slate-500">Create a wallet with type Credit Card first.</p></div> : <>
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[18px] border border-white/10 bg-[#0d141e] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Cards</p><p className="mt-1 text-xl font-semibold text-white">{data.length}</p></div>
            <div className="rounded-[18px] border border-white/10 bg-[#0d141e] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Outstanding</p><p className="mt-1 text-xl font-semibold text-white">Rp{totalOutstanding.toLocaleString("id-ID")}</p></div>
            <div className="rounded-[18px] border border-amber-400/10 bg-[#0d141e] px-4 py-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Due Soon</p><p className="mt-1 text-xl font-semibold text-amber-300">{dueSoonCount}</p></div>
            <div className={`rounded-[18px] border px-4 py-4 ${overdueCount > 0 ? "border-red-400/20 bg-red-400/[0.04]" : "border-white/10 bg-[#0d141e]"}`}><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Overdue</p><p className={`mt-1 text-xl font-semibold ${overdueCount > 0 ? "text-red-300" : "text-emerald-300"}`}>{overdueCount}</p></div>
          </section>

          <div className="space-y-4">
            {data.map((card, index) => <CreditCardAccountCard key={card.wallet.id} wallet={card.wallet} statements={card.statements} forecast={card.forecast} defaultExpanded={index === 0 && (card.status === "OVERDUE" || (daysUntil(card.dueDate) ?? 99) <= 7)} />)}
          </div>
        </>}
      </div>
    </AppShell>
  );
}
