"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, SlidersHorizontal, X } from "lucide-react";

const STORAGE_KEY = "okane.dashboard.mobile-layout.v1";

export type DashboardMobileSection = {
  id: string;
  label: string;
  desktopClassName: string;
  content: ReactNode;
};

type LayoutConfig = { order: string[]; hidden: string[] };

function getDefaultConfig(sections: DashboardMobileSection[]): LayoutConfig {
  return { order: sections.map(({ id }) => id), hidden: [] };
}

function readConfig(sections: DashboardMobileSection[]): LayoutConfig {
  const defaults = getDefaultConfig(sections);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<LayoutConfig> | null;
    if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return defaults;
    const knownIds = new Set(defaults.order);
    const order = [...new Set(parsed.order.filter((id): id is string => typeof id === "string" && knownIds.has(id)))];
    return {
      order: [...order, ...defaults.order.filter((id) => !order.includes(id))],
      hidden: [...new Set(parsed.hidden.filter((id): id is string => typeof id === "string" && knownIds.has(id)))],
    };
  } catch {
    return defaults;
  }
}

export default function DashboardMobileLayout({ sections }: { sections: DashboardMobileSection[] }) {
  const [config, setConfig] = useState(() => getDefaultConfig(sections));
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setConfig(readConfig(sections));
    setHasLoaded(true);
  }, [sections]);

  useEffect(() => {
    if (!hasLoaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Keep the dashboard usable when browser storage is unavailable.
    }
  }, [config, hasLoaded]);

  const positionById = new Map(config.order.map((id, index) => [id, index]));

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
    setConfig(getDefaultConfig(sections));
  }

  return (
    <>
      <div className="mb-3 flex justify-end md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#0d151e] px-3.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/30 hover:text-white"
        >
          <SlidersHorizontal size={15} className="text-emerald-400" />
          Atur tampilan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-12">
        {sections.map((section) => (
          <div
            key={section.id}
            className={`${config.hidden.includes(section.id) ? "hidden md:block" : ""} ${section.desktopClassName} [&>section]:mb-0 order-[var(--mobile-order)] md:order-none`}
            style={{ "--mobile-order": positionById.get(section.id) ?? sections.length } as CSSProperties}
          >
            {section.content}
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-layout-title" className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#101923] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="mobile-layout-title" className="text-base font-semibold text-white">Atur tampilan mobile</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">Geser urutan box dan pilih yang ingin ditampilkan di ponsel.</p>
              </div>
              <button type="button" aria-label="Tutup pengaturan tampilan" onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={18} /></button>
            </div>

            <ol className="mt-5 space-y-2">
              {config.order.map((id, index) => {
                const section = sections.find((item) => item.id === id);
                if (!section) return null;
                const isHidden = config.hidden.includes(id);
                return (
                  <li key={id} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${isHidden ? "border-white/5 bg-black/10 opacity-60" : "border-white/10 bg-white/[.025]"}`}>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-200">{section.label}</span>
                    <button type="button" aria-label={`Pindahkan ${section.label} ke atas`} disabled={index === 0} onClick={() => moveSection(id, -1)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-25"><ChevronUp size={17} /></button>
                    <button type="button" aria-label={`Pindahkan ${section.label} ke bawah`} disabled={index === config.order.length - 1} onClick={() => moveSection(id, 1)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-25"><ChevronDown size={17} /></button>
                    <button type="button" aria-label={`${isHidden ? "Tampilkan" : "Sembunyikan"} ${section.label}`} aria-pressed={!isHidden} onClick={() => toggleSection(id)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
                      {isHidden ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button type="button" onClick={resetLayout} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white">Kembalikan urutan awal</button>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b]">Selesai</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
