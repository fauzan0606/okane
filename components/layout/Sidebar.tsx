"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  Target,
  Landmark,
  PiggyBank,
  HandCoins,
  BarChart3,
  Settings,
} from "lucide-react";

type MenuItem = {
  icon: LucideIcon;
  label: string;
  href: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menus: MenuGroup[] = [
  {
    title: "Overview",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/",
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        icon: Wallet,
        label: "Wallet",
        href: "/wallet",
      },
      {
        icon: Receipt,
        label: "Transactions",
        href: "/transactions",
      },
      {
        icon: ArrowLeftRight,
        label: "Transfer",
        href: "/transfer",
      },
    ],
  },
  {
    title: "Planning",
    items: [
      {
        icon: Target,
        label: "Budget",
        href: "/budget",
      },
      {
        icon: PiggyBank,
        label: "Goals",
        href: "/goals",
      },
    ],
  },
  {
    title: "Wealth",
    items: [
      {
        icon: Landmark,
        label: "Assets",
        href: "/assets",
      },
      {
        icon: HandCoins,
        label: "Debt",
        href: "/debt",
      },
    ],
  },
  {
    title: "Insight",
    items: [
      {
        icon: BarChart3,
        label: "Analytics",
        href: "/analytics",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-72 flex-col border-r border-white/10 bg-[#111827]">
      <div className="px-8 pt-8 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-white">
          OKANE
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Personal Financial Operating System
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {menus.map((group) => (
          <div key={group.title} className="mb-8">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </p>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={20} />

                  <span className="font-medium">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-4">
        <Link
          href="/settings"
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition ${
            pathname === "/settings"
              ? "bg-blue-600 text-white shadow-lg"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Settings size={20} />

          <span className="font-medium">
            Settings
          </span>
        </Link>
      </div>
    </aside>
  );
}