"use client";

import { useEffect, useState } from "react";

const scenarios = [
  { key: "easy_win", label: "Easy Win", seconds: 25 },
  { key: "negotiation", label: "Negotiation", seconds: 50 },
  { key: "escalation", label: "Escalation", seconds: 80 },
] as const;

interface DemoRunResponse {
  grievanceId?: string;
}

export function DevPanel({
  demoInFlight,
  initialVisible,
  onRun,
}: {
  demoInFlight: boolean;
  initialVisible: boolean;
  onRun?: (grievanceId?: string) => void;
}) {
  const [visible, setVisible] = useState(initialVisible);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") setVisible(true);
  }, []);

  if (!visible) return null;

  async function runScenario(scenario: (typeof scenarios)[number]["key"]) {
    setBusy(true);
    setLastRun(`${scenario} starting`);
    try {
      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const result = response.ok ? ((await response.json()) as DemoRunResponse) : {};
      setLastRun(`${scenario} sent`);
      onRun?.(result.grievanceId);
    } catch {
      setLastRun(`${scenario} failed`);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || demoInFlight;

  return (
    <div className="fixed bottom-20 left-4 z-50 w-[260px] border border-[var(--border)] bg-[#0B0A08]/95 p-4 backdrop-blur-sm">
      <p className="mono text-[10px] uppercase text-[#B8954E]">Demo Control</p>
      <div className="mt-3 space-y-2 border-y border-[var(--border)] py-3">
        {scenarios.map((scenario) => (
          <button
            className="mono flex w-full items-center justify-between border border-[var(--border)] px-3 py-2 text-xs uppercase text-[var(--text-primary)] hover:border-[#C03022] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled}
            key={scenario.key}
            onClick={() => runScenario(scenario.key)}
            type="button"
          >
            <span>{scenario.label}</span>
            <span>[{scenario.seconds}s]</span>
          </button>
        ))}
      </div>
      <p className="mono mt-3 text-[10px] uppercase text-[var(--text-muted)]">
        Last run: {lastRun ?? "none"}
      </p>
    </div>
  );
}
