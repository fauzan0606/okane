import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import DashboardMobileLayoutSettings from "@/modules/dashboard/components/DashboardMobileLayoutSettings";

export default function SettingsPage() {
  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Preferences</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Settings</h1>
          <p className="mt-2 text-sm text-slate-400">Customize how OKANE looks and works for you.</p>
        </header>
        <DashboardMobileLayoutSettings />
      </div>
    </AppShell>
  );
}
