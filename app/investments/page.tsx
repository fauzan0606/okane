import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardV2 from "@/modules/investment/components/InvestmentDashboardV2";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentDashboardV2 />
    </AppShell>
  );
}
