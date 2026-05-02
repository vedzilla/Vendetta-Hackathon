/**
 * Mubit — managed memory layer. Sponsor track.
 * Wire `getContext()` BEFORE every important LLM call, `reflect()` AFTER
 * every campaign closes, and `surfaceStrategies()` for the dashboard right rail.
 *
 * Implementation in Block A→B (Terminal 1).
 */

import type { GrievanceCategory } from "@/types/grievance";

export interface MemoryContext {
  /** Free-form prose injected into the LLM system prompt. */
  text: string;
  /** Structured lessons used by the dashboard right rail. */
  lessons: MubitLesson[];
}

export interface MubitLesson {
  id: string;
  category: GrievanceCategory;
  text: string;
  strength: number;
  createdAt: string;
}

export interface RememberInput {
  grievanceId: string;
  kind: "fact" | "decision" | "outcome";
  content: string;
  metadata?: Record<string, unknown>;
}

export async function getMemoryContext(_input: {
  grievanceId: string;
  query: string;
}): Promise<MemoryContext> {
  throw new Error("not implemented: getMemoryContext");
}

export async function remember(_input: RememberInput): Promise<void> {
  throw new Error("not implemented: remember");
}

export async function reflect(_input: { grievanceId: string }): Promise<MubitLesson[]> {
  throw new Error("not implemented: reflect");
}

export async function recordOutcome(_input: {
  grievanceId: string;
  outcome: "WON" | "LOST" | "CANCELLED";
  amountRecovered?: number;
}): Promise<void> {
  throw new Error("not implemented: recordOutcome");
}

export async function surfaceStrategies(_input: {
  category?: GrievanceCategory;
  limit?: number;
}): Promise<MubitLesson[]> {
  throw new Error("not implemented: surfaceStrategies");
}
