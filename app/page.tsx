import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { getDashboard } from "@/modules/dashboard";
import DashboardView from "@/modules/dashboard/components/DashboardView";
import type { DashboardPeriod } from "@/modules/dashboard";

const periods: DashboardPeriod[] = ["THIS_MONTH", "LAST_MONTH", "THIS_YEAR"];

function isDashboardPeriod(value: string | undefined): value is DashboardPeriod {
  return value !== undefined && periods.includes(value as DashboardPeriod);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const period = isDashboardPeriod(params.period)
    ? params.period
    : "THIS_MONTH";
  const currencyCode = params.currency ?? "IDR";
  const dashboard = await getDashboard({ period, currencyCode });

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <DashboardView data={dashboard} />
    </AppShell>
  );
}
