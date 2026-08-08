import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { ensureStatement, getCreditCardStatements } from "@/modules/credit-card/service";
import CreditCardStatementCard from "@/modules/credit-card/components/CreditCardStatementCard";

export default async function CreditCardPage() {
  const cards = await prisma.wallet.findMany({
    where: { isActive: true, walletType: "CREDIT_CARD", creditCard: { isNot: null } },
    include: { currency: true, creditCard: true },
    orderBy: { name: "asc" },
  });

  const data = await Promise.all(cards.map(async (wallet) => {
    await ensureStatement(wallet.id);
    return { wallet, statements: await getCreditCardStatements(wallet.id) };
  }));

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Credit Cards</h1>
          <p className="mt-2 text-slate-500">Track statements, reconciliation, due dates, and payments.</p>
        </div>

        {data.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0E151E] p-12 text-center">
            <p className="text-lg font-semibold text-white">No credit card wallets</p>
            <p className="mt-2 text-sm text-slate-500">Create a wallet with type Credit Card first.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {data.map(({ wallet, statements }) => (
              <section key={wallet.id} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{wallet.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Limit {wallet.currency.symbol}{Number(wallet.creditCard!.creditLimit).toLocaleString("id-ID")} · Billing day {wallet.creditCard!.billingDate} · Due day {wallet.creditCard!.dueDate}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4">
                  {statements.map((statement) => (
                    <CreditCardStatementCard key={statement.id} statement={statement} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
