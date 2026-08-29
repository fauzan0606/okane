import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardFinal from "@/modules/investment/components/InvestmentDashboardFinal";
import InvestmentAccountFormValidationFix from "@/modules/investment/components/InvestmentAccountFormValidationFix";
import InvestmentTransactionSplitView from "@/modules/investment/components/InvestmentTransactionSplitView";
import InvestmentTransactionLayoutFix from "@/modules/investment/components/InvestmentTransactionLayoutFix";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentAccountFormValidationFix>
        <InvestmentTransactionLayoutFix />
        <InvestmentTransactionSplitView>
          <InvestmentDashboardFinal />
        </InvestmentTransactionSplitView>
      </InvestmentAccountFormValidationFix>
    </AppShell>
  );
}
