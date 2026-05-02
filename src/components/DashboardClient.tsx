"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

// Disable SSR for the Dashboard tree: it renders relative timestamps
// ("5m ago") and other Date.now()-based labels during render, which
// otherwise produces hydration mismatches (React error #418). Real
// data still streams in via /api/grievances polling.
const Dashboard = dynamic(
  () => import("@/components/Dashboard").then((m) => m.Dashboard),
  { ssr: false },
);

interface BoundaryState {
  error: Error | null;
}

class DashboardErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Surface to console so we can see what crashed without unmounting silently.
    console.error("[Dashboard] render crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0F0E0C] p-8 text-[#D8D0C2]">
          <div className="mx-auto max-w-2xl border border-[#C03022]/40 bg-[#1A1714] p-6">
            <p className="mono text-[10px] uppercase text-[#C03022]">Dashboard error</p>
            <p className="serif mt-3 text-2xl text-[var(--text-primary)]">
              The dashboard hit a render error.
            </p>
            <pre className="mono mt-4 overflow-auto whitespace-pre-wrap break-words text-xs text-[#D8D0C2]/80">
              {this.state.error.message}
            </pre>
            <button
              className="mono mt-6 border border-[#B8954E]/60 px-3 py-2 text-xs uppercase text-[#B8954E]"
              onClick={() => this.setState({ error: null })}
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DashboardClient(props: { initialDevPanelVisible: boolean }) {
  return (
    <DashboardErrorBoundary>
      <Dashboard {...props} />
    </DashboardErrorBoundary>
  );
}
