import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboard from "@/modules/investment/components/InvestmentDashboard";

export default function InvestmentsPage() {
  return <AppShell sidebar={<Sidebar />} header={null}><InvestmentDashboard /></AppShell>;
}
