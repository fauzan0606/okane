import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardFinal from "@/modules/investment/components/InvestmentDashboardFinal";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentDashboardFinal />
    </AppShell>
  );
}
