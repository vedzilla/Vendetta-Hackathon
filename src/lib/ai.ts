/**
 * Vercel AI Gateway — every LLM call routes through here. Two model strings
 * are allowed: opus for reasoning, sonnet for fast classification/extraction.
 *
 * Implementation in Block A→B (Terminal 1).
 */

import type { LanguageModel } from "ai";

export const REASONING_MODEL_ID = "anthropic/claude-opus-4-7" as const;
export const FAST_MODEL_ID = "anthropic/claude-sonnet-4-6" as const;

export type AllowedModelId = typeof REASONING_MODEL_ID | typeof FAST_MODEL_ID;

export const reasoningModel: LanguageModel = (() => {
  throw new Error("not implemented: reasoningModel — wire AI Gateway in src/lib/ai.ts");
})();

export const fastModel: LanguageModel = (() => {
  throw new Error("not implemented: fastModel — wire AI Gateway in src/lib/ai.ts");
})();

export async function transcribeAudio(_audioUrl: string): Promise<string> {
  throw new Error("not implemented: transcribeAudio");
}
