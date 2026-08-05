import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import StatCard from "@/components/ui/StatCard";
import { dashboard } from "@/data/dashboard";
import CashflowChart from "@/components/dashboard/CashflowChart";

export default function Home() {
  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
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

        <div className="mt-8">
          <CashflowChart />
        </div>
      
      </div>
    </AppShell>
  );
}