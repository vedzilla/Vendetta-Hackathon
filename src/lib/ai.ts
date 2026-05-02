/**
 * Vercel AI Gateway — every LLM call in Vendetta routes through here.
 *
 * Why: keeps a single auth surface (one gateway key locally, OIDC on Vercel),
 * gives us automatic provider failover, and is what the hackathon judges look
 * for in the code. Do not import provider SDKs (`@ai-sdk/anthropic`,
 * `@ai-sdk/openai`) directly anywhere else in the app.
 *
 * Transcription is disabled for the hackathon scope — voice notes are
 * processed client-side by Codex's frontend before the workflow ever sees
 * the grievance description. Re-add a Whisper helper here when needed.
 */

import { gateway } from "ai";

export const REASONING_MODEL_ID = "anthropic/claude-opus-4-7" as const;
export const FAST_MODEL_ID = "anthropic/claude-sonnet-4-6" as const;

export type AllowedModelId = typeof REASONING_MODEL_ID | typeof FAST_MODEL_ID;

/**
 * REASONING — Claude Opus 4.7. Use for legal analysis, draft letter
 * generation, escalation logic, and complex reply classification.
 */
export const reasoningModel = gateway(REASONING_MODEL_ID);

/**
 * FAST — Claude Sonnet 4.6. Use for category classification, fact
 * extraction, intent detection, and short summaries. ~10x cheaper than opus.
 */
export const fastModel = gateway(FAST_MODEL_ID);
