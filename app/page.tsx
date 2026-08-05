import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

import StatCard from "@/components/ui/StatCard";

export default function Home() {
  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Net Worth"
          value="Rp0"
        />

        <StatCard
          title="Income"
          value="Rp0"
        />

        <StatCard
          title="Expense"
          value="Rp0"
        />

        <StatCard
          title="Saving"
          value="Rp0"
        />

      </div>
    </AppShell>
  );
}