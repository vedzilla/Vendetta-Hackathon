/**
 * Vercel AI Gateway — every LLM call in Vendetta routes through here.
 *
 * Why: keeps a single auth surface (one gateway key locally, OIDC on Vercel),
 * gives us automatic provider failover, and is what the hackathon judges look
 * for in the code. Do not import provider SDKs (`@ai-sdk/anthropic`,
 * `@ai-sdk/openai`) directly anywhere else in the app.
 */

import { experimental_transcribe as transcribe, gateway } from "ai";

export const REASONING_MODEL_ID = "anthropic/claude-opus-4-7" as const;
export const FAST_MODEL_ID = "anthropic/claude-sonnet-4-6" as const;
export const TRANSCRIPTION_MODEL_ID = "openai/whisper-1" as const;

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

/**
 * Transcription model — Whisper via the AI Gateway. Used for Telegram
 * voice notes describing a grievance.
 */
export const transcriptionModel = gateway.transcription(TRANSCRIPTION_MODEL_ID);

/**
 * Transcribe a remote audio file (e.g. a Telegram voice note URL). Returns
 * the raw transcript text. Throws on network or model failure — callers
 * inside workflows should wrap this in a `"use step"` so retries are durable.
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(
      `transcribeAudio: failed to fetch audio (${response.status}) from ${audioUrl}`,
    );
  }
  const audio = new Uint8Array(await response.arrayBuffer());

  const { text } = await transcribe({
    model: transcriptionModel,
    audio,
  });

  return text;
}
