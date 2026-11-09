"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getDefaultDashboardMobileLayout, readDashboardMobileLayout, saveDashboardMobileLayout } from "./dashboardMobileLayoutConfig";

export type DashboardMobileSection = {
  id: string;
  label: string;
  desktopClassName: string;
  content: ReactNode;
};

export default function DashboardMobileLayout({ sections }: { sections: DashboardMobileSection[] }) {
  const [config, setConfig] = useState(getDefaultDashboardMobileLayout);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setConfig(readDashboardMobileLayout());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    saveDashboardMobileLayout(config);
  }, [config, hasLoaded]);

  const positionById = new Map(config.order.map((id, index) => [id, index]));

  return (
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
  );
}
