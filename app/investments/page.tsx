import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboardFinal from "@/modules/investment/components/InvestmentDashboardFinal";
import InvestmentAccountFormValidationFix from "@/modules/investment/components/InvestmentAccountFormValidationFix";
import InvestmentTransactionSplitView from "@/modules/investment/components/InvestmentTransactionSplitView";
import InvestmentCashTransfer from "@/modules/investment/components/InvestmentCashTransfer";

export default function InvestmentsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={null}>
      <InvestmentAccountFormValidationFix>
        <InvestmentTransactionSplitView>
          <InvestmentCashTransfer />
          <InvestmentDashboardFinal />
        </InvestmentTransactionSplitView>
      </InvestmentAccountFormValidationFix>
    </AppShell>
  );
}
