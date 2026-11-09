"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import {
  DASHBOARD_MOBILE_SECTIONS,
  getDefaultDashboardMobileLayout,
  readDashboardMobileLayout,
  saveDashboardMobileLayout,
  type DashboardMobileLayoutConfig,
} from "./dashboardMobileLayoutConfig";

export default function DashboardMobileLayoutSettings() {
  const [config, setConfig] = useState<DashboardMobileLayoutConfig>(getDefaultDashboardMobileLayout);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setConfig(readDashboardMobileLayout());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (hasLoaded) saveDashboardMobileLayout(config);
  }, [config, hasLoaded]);

  function moveSection(id: string, offset: -1 | 1) {
    setConfig((current) => {
      const index = current.order.indexOf(id);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.order.length) return current;
      const order = [...current.order];
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...current, order };
    });
  }

  function toggleSection(id: string) {
    setConfig((current) => ({
      ...current,
      hidden: current.hidden.includes(id) ? current.hidden.filter((hiddenId) => hiddenId !== id) : [...current.hidden, id],
    }));
  }

  function resetLayout() {
    setConfig(getDefaultDashboardMobileLayout());
  }

  return (
    <section className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.12)] sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Dashboard</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Tampilan mobile</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Atur urutan box dan pilih yang ingin ditampilkan di Dashboard ponsel.</p>
        </div>
        <span className="shrink-0 text-[10px] text-slate-500">Tersimpan otomatis di browser ini</span>
      </div>

      <ol className="mt-5 space-y-2">
        {config.order.map((id, index) => {
          const section = DASHBOARD_MOBILE_SECTIONS.find((item) => item.id === id);
          if (!section) return null;
          const isHidden = config.hidden.includes(id);
          return (
            <li key={id} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${isHidden ? "border-white/5 bg-black/10 opacity-60" : "border-white/10 bg-white/[.025]"}`}>
              <span className="min-w-0 flex-1 text-sm font-medium text-slate-200">{section.label}</span>
              <button type="button" aria-label={`Pindahkan ${section.label} ke atas`} disabled={index === 0} onClick={() => moveSection(id, -1)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-25"><ChevronUp size={17} /></button>
              <button type="button" aria-label={`Pindahkan ${section.label} ke bawah`} disabled={index === config.order.length - 1} onClick={() => moveSection(id, 1)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-25"><ChevronDown size={17} /></button>
              <button type="button" aria-label={`${isHidden ? "Tampilkan" : "Sembunyikan"} ${section.label}`} aria-pressed={!isHidden} onClick={() => toggleSection(id)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
                {isHidden ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
        <button type="button" onClick={resetLayout} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">Kembalikan urutan awal</button>
      </div>
    </section>
  );
}
