/**
 * Time-warp helper. The workflow uses this everywhere instead of raw sleep().
 * scale=1 → real durations. scale=12000 → 14 days collapse to ~100s.
 * Floor of 2s ensures the FAST FORWARD overlay stays legible on stage.
 *
 * Implementation in Block B (Terminal 1).
 */

export type DurationString = `${number}${"s" | "m" | "h"}` | `${number} ${"day" | "days"}`;

export async function demoSleep(
  _realDuration: DurationString | string,
  _demoScale: number = 1
): Promise<void> {
  throw new Error("not implemented: demoSleep");
}

export function parseDuration(_s: string): number {
  throw new Error("not implemented: parseDuration");
}
