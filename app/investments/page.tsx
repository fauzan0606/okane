import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardV5 from "@/modules/investment/components/InvestmentDashboardV5";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentDashboardV5 />
    </AppShell>
  );
}
