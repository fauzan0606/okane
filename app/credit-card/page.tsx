import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { ensureStatement, getCreditCardStatements, getStatementForecast } from "@/modules/credit-card/service";
import CreditCardStatementCard from "@/modules/credit-card/components/CreditCardStatementCard";
import type { CreditCardStatement } from "@prisma/client";

type SerializedStatement = Omit<CreditCardStatement, "calculatedAmount" | "actualAmount" | "paidAmount" | "statementDate" | "periodStart" | "periodEnd" | "dueDate" | "paidAt" | "createdAt" | "updatedAt"> & {
  calculatedAmount: string;
  actualAmount: string | null;
  paidAmount: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function serializeStatement(statement: CreditCardStatement): SerializedStatement {
  return {
    ...statement,
    calculatedAmount: statement.calculatedAmount.toString(),
    actualAmount: statement.actualAmount?.toString() ?? null,
    paidAmount: statement.paidAmount.toString(),
    statementDate: statement.statementDate.toISOString(),
    periodStart: statement.periodStart.toISOString(),
    periodEnd: statement.periodEnd.toISOString(),
    dueDate: statement.dueDate.toISOString(),
    paidAt: statement.paidAt?.toISOString() ?? null,
    createdAt: statement.createdAt.toISOString(),
    updatedAt: statement.updatedAt.toISOString(),
  };
}

export default async function CreditCardPage() {
  const cards = await prisma.wallet.findMany({
    where: { isActive: true, walletType: "CREDIT_CARD" },
    include: { currency: true, creditCard: true },
    orderBy: { name: "asc" },
  });

  const data = await Promise.all(cards.map(async (wallet) => {
    if (!wallet.creditCard) return { wallet, statements: [], forecast: null };
    await ensureStatement(wallet.id);
    const statements = await getCreditCardStatements(wallet.id);
    return {
      wallet,
      statements: statements.map(serializeStatement),
      forecast: await getStatementForecast(wallet.id),
    };
  }));

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Credit Cards</h1>
          <p className="mt-2 text-slate-500">Track statements, reconciliation, due dates, payments, and the next estimated bill.</p>
        </div>

        {data.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0E151E] p-12 text-center">
            <p className="text-lg font-semibold text-white">No credit card wallets</p>
            <p className="mt-2 text-sm text-slate-500">Create a wallet with type Credit Card first.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {data.map(({ wallet, statements, forecast }) => (
              <section key={wallet.id} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{wallet.name}</h2>
                  {wallet.creditCard ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Limit {wallet.currency.symbol}{Number(wallet.creditCard.creditLimit).toLocaleString("id-ID")} · Billing day {wallet.creditCard.billingDate} · Due day {wallet.creditCard.dueDate}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-300">Credit card settings are not configured yet. Edit this wallet to add the credit limit and billing cycle.</p>
                  )}
                </div>

                {forecast && (
                  <div className="rounded-[20px] border border-emerald-400/15 bg-emerald-400/[0.04] p-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-400">Next Statement — Estimated</p>
                        <p className="mt-2 text-2xl font-bold text-white">{wallet.currency.symbol}{forecast.amount.toLocaleString("id-ID")}</p>
                        <p className="mt-1 text-xs text-slate-500">Transactions from {forecast.periodStart.toLocaleDateString("id-ID")} through today · closes {forecast.statementDate.toLocaleDateString("id-ID")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Estimated due</p>
                        <p className="mt-1 font-semibold text-slate-200">{forecast.dueDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  {statements.map((statement) => <CreditCardStatementCard key={statement.id} statement={statement} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
