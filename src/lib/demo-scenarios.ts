/**
 * The three scripted demo scenarios. The simulated airline reply text is
 * canonical (see docs/09_DEMO_MODE.md) — do not rewrite once filled in.
 *
 * Implementation in Block B (Terminal 1). Until then, callers must use
 * getScenarios()/getScenario() rather than touching SCENARIOS at module load.
 */

import type { GrievanceFacts } from "@/types/grievance";

export type ScenarioKey = "easy_win" | "negotiation" | "escalation";

export interface ReplyBeat {
  /** Real-world delay before this beat fires; scaled by demoSleep(). */
  afterDelay: string;
  from: string;
  subject: string;
  body: string;
}

export interface DemoScenario {
  voiceNoteText: string;
  preExtractedFacts: GrievanceFacts;
  estimatedSeconds: number;
  beats: ReplyBeat[];
}

export function getScenarios(): Record<ScenarioKey, DemoScenario> {
  throw new Error("not implemented: getScenarios — populate from docs/09_DEMO_MODE.md");
}

export function getScenario(_key: ScenarioKey): DemoScenario {
  throw new Error("not implemented: getScenario");
}
