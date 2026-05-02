"use client";

import { useState } from "react";
import { ApprovalCard } from "./ApprovalCard";
import { CategoryBadge } from "./CategoryBadge";
import { FastForwardIndicator } from "./FastForwardIndicator";
import { StatusPill } from "./StatusPill";
import { TimelineView } from "./TimelineView";
import { displayCompany, type DashboardCampaign } from "./types";

const tabs = ["Timeline", "Letters", "Research", "Trace"] as const;
type Tab = (typeof tabs)[number];

function claimLabel(campaign: DashboardCampaign) {
  const amount = Number(campaign.facts.amountClaimed ?? 0);
  if (!amount) return "Claim open";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: campaign.facts.currency ?? "GBP",
  }).format(amount);
}

function workflowHref(workflowRunId?: string) {
  if (!workflowRunId) return null;
  return `https://vercel.com/dashboard/workflows/${workflowRunId}`;
}

export function CampaignDetail({
  campaign,
  onRefresh,
}: {
  campaign?: DashboardCampaign;
  onRefresh?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Timeline");

  if (!campaign) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#0F0E0C] p-6">
        <p className="serif text-center text-xl italic text-[var(--text-muted)]">
          Select a campaign to inspect the record.
        </p>
      </main>
    );
  }

  const traceHref = workflowHref(campaign.workflowRunId);
  const showFastForward = campaign.metadata?.demoMode && campaign.status === "AWAITING_REPLY";

  return (
    <main className="min-w-0 bg-[#0F0E0C]">
      <div className="border-b border-[var(--border)] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={campaign.category} />
              <StatusPill status={campaign.status} />
              {showFastForward ? <FastForwardIndicator /> : null}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <h2 className="serif text-4xl font-medium leading-none text-[var(--text-primary)] md:text-5xl">
                {displayCompany(campaign)}
              </h2>
              {showFastForward ? (
                <span
                  aria-hidden
                  className="relative h-5 w-5 rounded-full border border-[#C03022]/50"
                >
                  <span
                    className="absolute left-1/2 top-1/2 h-2 w-px origin-bottom bg-[#C03022]"
                    style={{ animation: "fast-clock 700ms linear infinite" }}
                  />
                </span>
              ) : null}
            </div>
          </div>
          <p className="mono text-2xl text-[#B8954E] md:text-3xl">{claimLabel(campaign)}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-b border-[var(--border)]">
          {tabs.map((nextTab) => (
            <button
              className={`mono -mb-px border-b px-3 py-3 text-xs uppercase ${
                tab === nextTab
                  ? "border-[#C03022] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              key={nextTab}
              onClick={() => setTab(nextTab)}
              type="button"
            >
              {nextTab}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 md:p-6">
        {tab === "Timeline" ? <TimelineView events={campaign.timeline} /> : null}
        {tab === "Letters" ? <LettersView campaign={campaign} onRefresh={onRefresh} /> : null}
        {tab === "Research" ? <ResearchView campaign={campaign} /> : null}
        {tab === "Trace" ? <TraceView href={traceHref} runId={campaign.workflowRunId} /> : null}
      </div>
    </main>
  );
}

function LettersView({
  campaign,
  onRefresh,
}: {
  campaign: DashboardCampaign;
  onRefresh?: () => void;
}) {
  const draft = campaign.draft ?? draftFromTimeline(campaign);
  return (
    <div className="space-y-4">
      {campaign.status === "AWAITING_APPROVAL" && draft ? (
        <ApprovalCard
          body={draft.body}
          grievanceId={campaign.id}
          onDecision={onRefresh}
          subject={draft.subject}
        />
      ) : null}
      {draft ? (
        <article className="border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mono text-[10px] uppercase text-[var(--text-muted)]">Latest draft</p>
          <h3 className="serif mt-2 text-2xl text-[var(--text-primary)]">{draft.subject}</h3>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#D8D0C2]">{draft.body}</p>
        </article>
      ) : (
        <p className="serif py-16 text-center italic text-[var(--text-muted)]">
          No letters drafted yet.
        </p>
      )}
    </div>
  );
}

function draftFromTimeline(campaign: DashboardCampaign) {
  const drafted = campaign.timeline.find((event) => event.kind === "drafted");
  if (!drafted) return undefined;
  const maybeDraft = drafted.payload?.draft;
  if (typeof maybeDraft === "object" && maybeDraft) {
    const draft = maybeDraft as { subject?: unknown; body?: unknown };
    if (typeof draft.subject === "string" && typeof draft.body === "string") {
      return { subject: draft.subject, body: draft.body };
    }
  }
  return {
    subject: `${campaign.facts.company ?? "Company"} complaint draft`,
    body: drafted.summary,
  };
}

function ResearchView({ campaign }: { campaign: DashboardCampaign }) {
  const research = campaign.research;
  if (!research) {
    return (
      <p className="serif py-16 text-center italic text-[var(--text-muted)]">
        Research has not landed yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <ResearchRow label="Complaints address" value={research.complaintsAddress} />
      <ResearchRow label="Regulator" value={research.regulatorName} />
      <ResearchRow label="Regulator URL" value={research.regulatorUrl} href={research.regulatorUrl} />
      <ResearchRow label="Response window" value={research.typicalResponseDays ? `${research.typicalResponseDays} days` : undefined} />
      <div className="border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mono text-[10px] uppercase text-[var(--text-muted)]">Statutes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(research.relevantStatutes ?? []).length > 0 ? (
            research.relevantStatutes?.map((statute) => (
              <span className="border border-[#B8954E]/50 px-2 py-1 text-sm text-[#D9BE7B]" key={statute}>
                {statute}
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--text-muted)]">Pending</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ResearchRow({ label, value, href }: { label: string; value?: string; href?: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mono text-[10px] uppercase text-[var(--text-muted)]">{label}</p>
      {href && value ? (
        <a className="mt-2 block break-all text-sm text-[#D9BE7B]" href={href} rel="noreferrer" target="_blank">
          {value}
        </a>
      ) : (
        <p className="mt-2 break-all text-sm text-[var(--text-primary)]">{value ?? "Pending"}</p>
      )}
    </div>
  );
}

function TraceView({ href, runId }: { href: string | null; runId?: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="mono text-[10px] uppercase text-[var(--text-muted)]">Workflow run</p>
      <p className="mono mt-3 break-all text-sm text-[var(--text-primary)]">{runId ?? "No run ID yet"}</p>
      {href ? (
        <a className="mono mt-5 inline-flex text-xs uppercase text-[#B8954E]" href={href} rel="noreferrer" target="_blank">
          View Workflow Trace →
        </a>
      ) : null}
    </div>
  );
}
