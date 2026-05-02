"use client";

import { CategoryBadge } from "./CategoryBadge";
import { FastForwardIndicator } from "./FastForwardIndicator";
import { StatusPill } from "./StatusPill";
import type { DashboardCampaign } from "./types";

function formatRelative(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function CampaignList({
  campaigns,
  selectedId,
  onSelect,
}: {
  campaigns: DashboardCampaign[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="border-b border-[var(--border)] bg-[var(--surface)] md:border-b-0 md:border-r">
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <p className="mono text-[10px] uppercase text-[var(--text-muted)]">Active Campaigns</p>
          <h1 className="serif mt-1 text-2xl font-medium text-[var(--text-primary)]">Vendetta</h1>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {campaigns.length === 0 ? (
            <p className="serif px-3 py-12 text-center italic text-[var(--text-muted)]">
              No campaigns yet.
            </p>
          ) : (
            campaigns.map((campaign) => {
              const selected = campaign.id === selectedId;
              const amount = Number(campaign.facts.amountClaimed ?? 0);
              return (
                <button
                  key={campaign.id}
                  className={`group relative w-full border bg-transparent p-4 text-left ${
                    selected
                      ? "border-l-[#C03022] border-r-[var(--border)] border-y-[var(--border)] border-l-2"
                      : "border-[var(--border)] hover:border-r-[#C03022]"
                  }`}
                  onClick={() => onSelect(campaign.id)}
                  type="button"
                >
                  {campaign.metadata?.demoMode && campaign.status === "AWAITING_REPLY" ? (
                    <span className="absolute right-3 top-3">
                      <FastForwardIndicator compact />
                    </span>
                  ) : null}
                  <div className="pr-20">
                    <p className="serif text-lg leading-tight text-[var(--text-primary)]">
                      {campaign.facts.company ?? "Unknown company"}
                    </p>
                    <p className="mono mt-1 text-xs text-[var(--text-muted)]">
                      {amount > 0 ? `${campaign.facts.currency ?? "GBP"} ${amount.toFixed(2)}` : campaign.id}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={campaign.category} />
                    <StatusPill status={campaign.status} />
                  </div>
                  <p className="mono mt-4 text-[10px] uppercase text-[var(--text-muted)]">
                    Updated {formatRelative(campaign.updatedAt)}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
