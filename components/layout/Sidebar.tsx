"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, BarChart3, LayoutDashboard, Landmark, PiggyBank, Receipt, Settings, Tags, Target, Wallet } from "lucide-react";

type MenuItem = { icon: LucideIcon; label: string; href: string };
type MenuGroup = { title: string; items: MenuItem[] };
const menus: MenuGroup[] = [
  { title: "Overview", items: [{ icon: LayoutDashboard, label: "Dashboard", href: "/" }] },
  { title: "Finance", items: [{ icon: Receipt, label: "Transactions", href: "/transactions" }, { icon: Wallet, label: "Wallets", href: "/wallet" }, { icon: Tags, label: "Categories", href: "/category" }, { icon: ArrowLeftRight, label: "Transfer", href: "/transfer" }] },
  { title: "Planning", items: [{ icon: PiggyBank, label: "Budget", href: "/budget" }, { icon: Target, label: "Goals", href: "/goals" }] },
  { title: "Wealth & Insight", items: [{ icon: Landmark, label: "Assets", href: "/assets" }, { icon: BarChart3, label: "Analytics", href: "/analytics" }] },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-white/10 bg-[#070c12] text-slate-100">
      <div className="px-7 pb-6 pt-7">
        <div className="flex flex-col items-center text-center">
          <Image src="/okane-mascot.svg" alt="OKANE" width={72} height={72} priority className="mb-2" />
          <div className="text-[30px] font-black leading-none tracking-[0.04em] text-white">OKANE</div>
          <div className="mt-1 text-[10px] font-medium tracking-wide text-emerald-400">Your Money, Your Freedom</div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {menus.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return <Link key={item.label} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-emerald-500/20 text-white shadow-[inset_0_0_0_1px_rgba(52,211,153,0.08)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}><Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-emerald-400" : "text-slate-500"} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}</Link>;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d141e] px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-300">F</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-200">Fauzan</p><p className="text-[10px] font-medium text-amber-400">Premium Plan</p></div><span className="text-slate-600">›</span>
        </div>
        <Link href="/settings" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === "/settings" ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}><Settings size={17} />Settings</Link>
      </div>
    </aside>
  );
}
