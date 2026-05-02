/**
 * Close-out step. Always runs, regardless of WON / LOST / CANCELLED.
 *
 *  - reflect() asks Mubit to extract durable lessons from this campaign's
 *    full memory trace. Each surfaced lesson becomes a "lesson_learned"
 *    timeline event so the dashboard's right rail can animate it in.
 *  - recordOutcome() upweights/downweights those lessons for future
 *    surfaceStrategies() ranking.
 *
 * The lesson fade-in is the single most important visual moment of the
 * demo (see docs/09_DEMO_MODE.md), so a clean lesson_learned event per
 * lesson matters more than the per-lesson `kind` taxonomy.
 */

import { recordOutcome, reflect } from "@/lib/mubit";
import { appendTimelineEvent, loadGrievance } from "@/lib/store";

import type { GrievanceStatus } from "@/types/grievance";

const TERMINAL_KIND_FOR: Record<"WON" | "LOST" | "CANCELLED", "won" | "lost" | "cancelled"> = {
  WON: "won",
  LOST: "lost",
  CANCELLED: "cancelled",
};

export async function reflectAndRecordStep(input: {
  grievanceId: string;
  outcome: "WON" | "LOST" | "CANCELLED";
}): Promise<void> {
  "use step";

  const grievance = await loadGrievance(input.grievanceId);
  const amountRecovered = input.outcome === "WON"
    ? (grievance.facts.amountClaimed as number | undefined)
    : undefined;

  const lessons = await reflect({ grievanceId: input.grievanceId });

  for (const lesson of lessons) {
    await appendTimelineEvent(input.grievanceId, {
      at: new Date().toISOString(),
      kind: "lesson_learned",
      summary: lesson.text,
      payload: {
        lessonId: lesson.id,
        category: lesson.category,
        strength: lesson.strength,
      },
    });
  }

  await recordOutcome({
    grievanceId: input.grievanceId,
    outcome: input.outcome,
    amountRecovered,
  });

  // Final terminal timeline event so the dashboard can render the close.
  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: TERMINAL_KIND_FOR[input.outcome],
    summary: input.outcome === "WON"
      ? `Campaign closed — won${amountRecovered ? ` £${amountRecovered}` : ""}`
      : input.outcome === "LOST"
        ? "Campaign closed — lost (lessons recorded)"
        : "Campaign closed — cancelled by user",
    payload: amountRecovered ? { amountRecovered } : undefined,
  });

  // Status mirror — the shell sets ESCALATED/WON earlier; for CANCELLED the
  // shell already set it. We don't re-mark here to avoid double-writes.
  void (grievance.status as GrievanceStatus);
}
