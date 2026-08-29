import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardFinal from "@/modules/investment/components/InvestmentDashboardFinal";
import InvestmentAccountFormValidationFix from "@/modules/investment/components/InvestmentAccountFormValidationFix";
import InvestmentTransactionLayoutFix from "@/modules/investment/components/InvestmentTransactionLayoutFix";
import InvestmentCashWithdrawPortal from "@/modules/investment/components/InvestmentCashWithdrawPortal";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentAccountFormValidationFix>
        <InvestmentTransactionLayoutFix />
        <InvestmentCashWithdrawPortal />
        <InvestmentDashboardFinal />
      </InvestmentAccountFormValidationFix>
    </AppShell>
  );
}
