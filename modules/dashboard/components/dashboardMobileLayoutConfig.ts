export const DASHBOARD_MOBILE_LAYOUT_STORAGE_KEY = "okane.dashboard.mobile-layout.v1";

export const DASHBOARD_MOBILE_SECTIONS = [
  { id: "income", label: "Total income" },
  { id: "expense", label: "Total expense" },
  { id: "cashflow", label: "Net cashflow" },
  { id: "assets", label: "Total assets" },
  { id: "budget", label: "Monthly budget" },
  { id: "category", label: "Spending by category" },
  { id: "condition", label: "Financial condition" },
  { id: "calendar", label: "Monthly calendar" },
  { id: "movement", label: "Money movement" },
  { id: "credit-cards", label: "Credit cards" },
  { id: "receivables", label: "Receivables" },
  { id: "wallets", label: "Wallets" },
  { id: "transactions", label: "Recent transactions" },
] as const;

export type DashboardMobileLayoutConfig = { order: string[]; hidden: string[] };

export function getDefaultDashboardMobileLayout(): DashboardMobileLayoutConfig {
  return { order: DASHBOARD_MOBILE_SECTIONS.map(({ id }) => id), hidden: [] };
}

export function readDashboardMobileLayout(): DashboardMobileLayoutConfig {
  const defaults = getDefaultDashboardMobileLayout();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DASHBOARD_MOBILE_LAYOUT_STORAGE_KEY) ?? "null") as Partial<DashboardMobileLayoutConfig> | null;
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

export function saveDashboardMobileLayout(config: DashboardMobileLayoutConfig) {
  try {
    window.localStorage.setItem(DASHBOARD_MOBILE_LAYOUT_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Keep the dashboard usable when browser storage is unavailable.
  }
}
