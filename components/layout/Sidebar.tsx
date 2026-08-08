"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Landmark,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  Target,
  Wallet,
} from "lucide-react";

type MenuItem = { icon: LucideIcon; label: string; href: string };
type MenuGroup = { title: string; items: MenuItem[] };

const menus: MenuGroup[] = [
  { title: "Overview", items: [{ icon: LayoutDashboard, label: "Dashboard", href: "/" }] },
  {
    title: "Finance",
    items: [
      { icon: Receipt, label: "Transactions", href: "/transactions" },
      { icon: Wallet, label: "Wallets", href: "/wallet" },
      { icon: Tags, label: "Categories", href: "/category" },
      { icon: ArrowLeftRight, label: "Transfer", href: "/transfer" },
    ],
  },
  {
    title: "Planning",
    items: [
      { icon: PiggyBank, label: "Budget", href: "/budget" },
      { icon: Target, label: "Goals", href: "/goals" },
    ],
  },
  {
    title: "Wealth & Insight",
    items: [
      { icon: Landmark, label: "Assets", href: "/assets" },
      { icon: BarChart3, label: "Analytics", href: "/analytics" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-7 pb-5 pt-7">
        <div className="flex items-center gap-3">
          <Image src="/okane-mascot.svg" alt="OKANE" width={48} height={48} priority />
          <div>
            <div className="text-[29px] font-black leading-none tracking-[-0.06em] text-slate-900">OKANE</div>
            <div className="mt-1 text-[9px] font-semibold tracking-wide text-emerald-600">Your Money, Your Freedom</div>
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {menus.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-amber-50 text-slate-900 shadow-[inset_0_0_0_1px_#f7dfad]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.9} className={isActive ? "text-amber-500" : "text-slate-400"} />
                    <span>{item.label}</span>
                    {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm">F</div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-800">Fauzan</p>
            <p className="text-[10px] font-medium text-amber-500">Personal Plan</p>
          </div>
        </div>
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            pathname === "/settings" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Settings size={17} className="text-slate-400" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
