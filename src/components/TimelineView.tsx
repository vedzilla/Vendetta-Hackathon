import type { TimelineEvent } from "@/types/grievance";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

const eventMarks: Record<TimelineEvent["kind"], string> = {
  received: "IN",
  classified: "CL",
  researched: "RS",
  drafted: "DR",
  approval_requested: "AP",
  approved: "OK",
  edited: "ED",
  cancelled: "CN",
  sent: "TX",
  reply_received: "RX",
  negotiating: "NG",
  escalated: "ES",
  lesson_learned: "LL",
  won: "WN",
  lost: "LS",
};

export function TimelineView({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="serif py-16 text-center italic text-[var(--text-muted)]">
        The record is clean. First movement will appear here.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {events
        .slice()
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .map((event) => (
          <li
            key={`${event.at}-${event.kind}-${event.summary}`}
            className="grid grid-cols-[56px_1fr] gap-4 border border-[var(--border)] bg-[var(--surface)] p-4"
            style={{ animation: "slide-fade-in 150ms ease-out" }}
          >
            <div>
              <span className="mono inline-flex h-8 w-8 items-center justify-center border border-[var(--border-strong)] text-[10px] text-[#B8954E]">
                {eventMarks[event.kind]}
              </span>
            </div>
            <div>
              <p className="text-sm leading-6 text-[var(--text-primary)]">{event.summary}</p>
              <p className="mono mt-2 text-[10px] uppercase text-[var(--text-muted)]">{formatTime(event.at)}</p>
            </div>
          </li>
        ))}
    </ol>
  );
}
