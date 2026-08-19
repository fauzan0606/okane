import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import InvestmentDashboard from "@/modules/investment/components/InvestmentDashboard";

export default function InvestmentsPage() {
  return <AppShell sidebar={<Sidebar />} header={null}><InvestmentDashboard /><div className="mx-auto max-w-[1400px] px-5 pb-10 lg:px-8"><Link href="/investments/fees" className="text-xs font-bold uppercase tracking-wide text-emerald-400">Fee & Tax Rules →</Link></div></AppShell>;
}
