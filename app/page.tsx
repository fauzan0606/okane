import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import StatCard from "@/components/ui/StatCard";
import { dashboard } from "@/data/dashboard";

export default function Home() {
  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">OKANE</h1>
          <p className="text-gray-500 mt-2">
            Personal Financial Operating System
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Net Worth"
            value={dashboard.netWorth}
          />

          <StatCard
            title="Income"
            value={dashboard.income}
          />

          <StatCard
            title="Expense"
            value={dashboard.expense}
          />

          <StatCard
            title="Safe to Spend"
            value={dashboard.safeToSpend}
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8">
          <h2 className="text-xl font-semibold">
            🚧 Dashboard is under development
          </h2>

          <p className="mt-3 text-zinc-400">
            Next milestone: Wallet CRUD
          </p>
        </div>
      </div>
    </AppShell>
  );
}