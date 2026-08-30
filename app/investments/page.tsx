import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardV7 from "@/modules/investment/components/InvestmentDashboardV7";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentDashboardV7 />
    </AppShell>
  );
}
