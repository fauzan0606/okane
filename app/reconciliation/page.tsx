import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { getReconciliationSession, getReconciliationWallets } from "@/modules/reconciliation/service";
import ReconciliationClient from "@/modules/reconciliation/components/ReconciliationClient";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const params = await searchParams;
  const [wallets, session] = await Promise.all([
    getReconciliationWallets(),
    params.session ? getReconciliationSession(params.session) : Promise.resolve(null),
  ]);

  return <AppShell sidebar={<Sidebar />} header={<Header />}>
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Statement control</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Reconciliation</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Compare a PDF bank or credit-card statement against OKANE without changing transactions until you explicitly confirm each difference.</p>
      </div>
      <ReconciliationClient wallets={wallets} session={session} />
    </div>
  </AppShell>;
}
