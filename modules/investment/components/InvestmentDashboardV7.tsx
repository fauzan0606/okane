"use client";

// V7 currently reuses the validated V6 implementation. Keeping V7 as a thin
// compatibility wrapper avoids duplicating the large investment dashboard and
// prevents syntax drift between successive UI iterations.
export { default } from "./InvestmentDashboardV6";
