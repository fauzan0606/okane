import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardFinal from "@/modules/investment/components/InvestmentDashboardFinal";
import InvestmentAccountFormValidationFix from "@/modules/investment/components/InvestmentAccountFormValidationFix";
import InvestmentMinimumSellColumn from "@/modules/investment/components/InvestmentMinimumSellColumn";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentAccountFormValidationFix>
        <InvestmentMinimumSellColumn>
          <InvestmentDashboardFinal />
        </InvestmentMinimumSellColumn>
      </InvestmentAccountFormValidationFix>
    </AppShell>
  );
}
