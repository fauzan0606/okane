"use client";

import InvestmentDashboardV7 from "./InvestmentDashboardV7";

/**
 * Current Investments composition.
 * Keep layout behavior declarative inside the dashboard components; do not use
 * DOM mutation cleanup scripts for account header content.
 */
export default function InvestmentDashboardV8() {
  return <InvestmentDashboardV7 />;
}
