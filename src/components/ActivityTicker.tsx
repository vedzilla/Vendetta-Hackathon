import type { DashboardCampaign } from "./types";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function ActivityTicker({ campaigns }: { campaigns: DashboardCampaign[] }) {
  const events = campaigns
    .flatMap((campaign) =>
      campaign.timeline.map((event) => ({
        id: `${campaign.id}-${event.at}-${event.kind}`,
        company: campaign.facts.company ?? "Unknown",
        summary: event.summary,
        at: event.at,
      }))
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);

  const row = events.length > 0 ? events : [{ id: "empty", company: "Vendetta", summary: "Waiting for live activity", at: new Date().toISOString() }];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-[60px] overflow-hidden border-t border-[var(--border)] bg-[#0F0E0C]/95">
      <div className="flex h-full items-center">
        <div className="mono border-r border-[var(--border)] px-5 text-[10px] uppercase text-[#B8954E]">
          Live Activity
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex w-max gap-8 pl-6" style={{ animation: "ticker-scroll 34s linear infinite" }}>
            {[...row, ...row].map((event, index) => (
              <span className="mono whitespace-nowrap text-xs text-[var(--text-muted)]" key={`${event.id}-${index}`}>
                <span className="text-[#B8954E]">{formatTime(event.at)}</span>{" "}
                <span className="text-[var(--text-primary)]">{event.company}</span> {event.summary}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
