"use client";

import dynamic from "next/dynamic";

// Disable SSR for the Dashboard tree: it renders relative timestamps
// ("5m ago") and other Date.now()-based labels during render, which
// otherwise produces hydration mismatches (React error #418). Real
// data still streams in via /api/grievances polling.
const Dashboard = dynamic(
  () => import("@/components/Dashboard").then((m) => m.Dashboard),
  { ssr: false },
);

export function DashboardClient(props: { initialDevPanelVisible: boolean }) {
  return <Dashboard {...props} />;
}
