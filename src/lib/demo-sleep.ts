/**
 * Time-warp helper. The workflow uses this everywhere instead of raw sleep().
 *
 *   scale = 1      → real durations (production)
 *   scale = 12000  → 14 days collapse to ~100s (the on-stage demo)
 *
 * A 2-second floor keeps the FAST FORWARD overlay legible — without it,
 * a 30-second real sleep at scale 12000 would resolve in 2.5ms and the
 * dashboard would never render the transition.
 *
 * Note: callers must be inside a `"use workflow"` (or step) — `sleep()` is
 * a workflow runtime primitive, not a generic Node.js timer.
 */

import { sleep } from "workflow";

export type DurationString = `${number}${"s" | "m" | "h" | "d"}` | `${number} ${"day" | "days"}`;

const UNIT_FACTORS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
};

const MIN_SCALED_MS = 2_000;

/**
 * Parse our duration grammar into milliseconds.
 *   "30s" → 30000
 *   "5m"  → 300000
 *   "14 days" → 1209600000
 */
export function parseDuration(s: string): number {
  const match = s.trim().match(/^(\d+)\s*(ms|s|m|h|d|days?)$/i);
  if (!match) {
    throw new Error(`Bad duration: "${s}"`);
  }
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const factor = UNIT_FACTORS[unit];
  if (!factor) {
    throw new Error(`Unknown duration unit: "${unit}"`);
  }
  return n * factor;
}

/**
 * Sleep for `realDuration`, scaled by `demoScale`.
 *   - scale === 1: pass through to workflow `sleep()` directly.
 *   - scale > 1:   divide and floor at MIN_SCALED_MS so the UI can keep up.
 */
export async function demoSleep(
  realDuration: DurationString | string,
  demoScale: number = 1,
): Promise<void> {
  if (demoScale <= 1) {
    return sleep(realDuration as DurationString);
  }

  const realMs = parseDuration(realDuration);
  const scaledMs = Math.max(MIN_SCALED_MS, Math.floor(realMs / demoScale));
  return sleep(scaledMs);
}
