"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, LayoutDashboard, Menu, Receipt, Settings, Wallet, X } from "lucide-react";
import { useState } from "react";
import { menus } from "./Sidebar";

const primaryItems = [
  { icon: LayoutDashboard, label: "Home", href: "/" },
  { icon: Receipt, label: "Transactions", href: "/transactions" },
  { icon: Wallet, label: "Wallets", href: "/wallet" },
  { icon: BriefcaseBusiness, label: "Investments", href: "/investments" },
];

export default function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#070c12]/95 px-4 backdrop-blur-xl md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition active:bg-white/10">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Image src="/okane-mascot.svg" alt="" width={30} height={30} priority />
            <span className="text-lg font-black tracking-[0.03em] text-white">OKANE</span>
          </div>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Online" />
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
          <aside className="relative flex h-full w-[min(86vw,340px)] flex-col border-r border-white/10 bg-[#070c12] text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
              <div className="flex items-center gap-2.5">
                <Image src="/okane-mascot.svg" alt="OKANE" width={38} height={38} priority />
                <div><div className="text-xl font-black tracking-[0.03em] text-white">OKANE</div><div className="text-[9px] font-medium tracking-wide text-emerald-400">Your Money, Your Freedom</div></div>
              </div>
              <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 active:bg-white/10"><X size={22} /></button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {menus.map((group) => (
                <div key={group.title} className="mb-6">
                  <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">{group.title}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      return <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition active:scale-[0.99] ${active ? "bg-emerald-500/20 text-white" : "text-slate-400 active:bg-white/5"}`}><Icon size={19} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-emerald-400" : "text-slate-500"} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}</Link>;
                    })}
                  </div>
                </div>
              ))}
              <Link href="/settings" onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${pathname === "/settings" ? "bg-white/10 text-white" : "text-slate-400"}`}><Settings size={19} /><span>Settings</span></Link>
            </nav>

            <div className="border-t border-white/5 p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d141e] px-3 py-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-300">F</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-200">Fauzan</p><p className="text-[10px] font-medium text-amber-400">Premium Plan</p></div></div>
            </div>
          </aside>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#070c12]/95 px-2 pt-2 shadow-[0_-12px_35px_rgba(0,0,0,0.25)] backdrop-blur-xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Primary navigation">
        <div className="mx-auto flex h-14 max-w-md items-start justify-around">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return <Link key={item.href} href={item.href} className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium ${active ? "text-emerald-400" : "text-slate-500"}`}><span className={`flex h-8 w-10 items-center justify-center rounded-xl ${active ? "bg-emerald-500/15" : ""}`}><Icon size={20} strokeWidth={active ? 2.3 : 1.8} /></span><span>{item.label}</span></Link>;
          })}
          <button type="button" onClick={() => setOpen(true)} aria-label="Open more navigation" className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium text-slate-500"><span className="flex h-8 w-10 items-center justify-center rounded-xl"><Menu size={20} /></span><span>More</span></button>
        </div>
      </nav>
    </>
  );
}
