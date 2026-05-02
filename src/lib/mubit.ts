/**
 * Mubit — managed memory layer (sponsor track).
 *
 * Wire `getMemoryContext()` BEFORE every important LLM call, `remember()`
 * after every meaningful step, `reflect()` and `recordOutcome()` when a
 * campaign closes, and `surfaceStrategies()` for the dashboard's right rail.
 *
 * All calls degrade gracefully — if Mubit is down the agent still works,
 * just without long-term memory.
 */

import { Client } from "@mubit-ai/sdk";

import type { GrievanceCategory } from "@/types/grievance";

const AGENT_ID = "vendetta";

let _client: Client | null = null;

function client(): Client {
  if (_client) return _client;
  if (!process.env.MUBIT_API_KEY) {
    throw new Error("MUBIT_API_KEY is not set");
  }
  _client = new Client({
    api_key: process.env.MUBIT_API_KEY,
    endpoint: process.env.MUBIT_ENDPOINT ?? "https://api.mubit.ai",
  });
  return _client;
}

const sessionFor = (grievanceId: string) => `vendetta:${grievanceId}`;

export interface MemoryContext {
  /** Free-form prose to inject into the LLM system prompt. */
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

/** Map our domain "kind" onto the Mubit SDK's wider `intent` taxonomy. */
const KIND_TO_INTENT: Record<RememberInput["kind"], string> = {
  fact: "fact",
  decision: "trace",
  outcome: "lesson",
};

const OUTCOME_TO_SIGNAL: Record<"WON" | "LOST" | "CANCELLED", { outcome: string; signal: number }> = {
  WON: { outcome: "success", signal: 0.9 },
  LOST: { outcome: "failure", signal: 0.6 },
  CANCELLED: { outcome: "neutral", signal: 0.3 },
};

/**
 * Coerce one of Mubit's loosely-typed lesson objects into our MubitLesson.
 * The SDK returns OperationResult (Record<string, unknown>) so we narrow here.
 */
function toLesson(raw: unknown, fallbackCategory: GrievanceCategory): MubitLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id ?? r.lesson_id ?? r.reference_id) as string | undefined;
  const text = (r.content ?? r.text ?? r.summary) as string | undefined;
  if (!id || !text) return null;
  const metadata = (r.metadata ?? {}) as Record<string, unknown>;
  const category = (metadata.vertical ?? r.category ?? fallbackCategory) as GrievanceCategory;
  const strength = typeof r.signal === "number"
    ? r.signal
    : typeof r.strength === "number"
      ? r.strength
      : 0.5;
  const createdAt = (r.created_at ?? r.createdAt ?? new Date().toISOString()) as string;
  return { id, category, text, strength, createdAt };
}

/**
 * Pull lessons from past campaigns ahead of an LLM call. Returns both a
 * compact prose block (for the system prompt) and the structured lessons
 * (so the workflow can log which ones it saw).
 */
export async function getMemoryContext(input: {
  grievanceId: string;
  query: string;
  category?: GrievanceCategory;
  tokenBudget?: number;
}): Promise<MemoryContext> {
  const session = sessionFor(input.grievanceId);
  const fallbackCategory = input.category ?? "UK_FLIGHT_DELAY";

  const [ctxResult, stratResult] = await Promise.allSettled([
    client().getContext({
      session_id: session,
      query: input.query,
      mode: "summary",
      max_token_budget: input.tokenBudget ?? 600,
      agent_id: AGENT_ID,
    }),
    client().surfaceStrategies({
      session_id: session,
      lesson_types: ["success", "failure"],
      max_strategies: 5,
    }),
  ]);

  let text = "";
  if (ctxResult.status === "fulfilled" && ctxResult.value && typeof ctxResult.value === "object") {
    const value = ctxResult.value as Record<string, unknown>;
    text = (value.context_block as string | undefined) ?? "";
  } else if (ctxResult.status === "rejected") {
    console.warn("[mubit] getContext failed", ctxResult.reason);
  }

  let lessons: MubitLesson[] = [];
  if (stratResult.status === "fulfilled" && stratResult.value && typeof stratResult.value === "object") {
    const value = stratResult.value as Record<string, unknown>;
    const raw = (value.strategies ?? value.lessons ?? []) as unknown[];
    lessons = raw
      .map((l) => toLesson(l, fallbackCategory))
      .filter((l): l is MubitLesson => l !== null);
  } else if (stratResult.status === "rejected") {
    console.warn("[mubit] surfaceStrategies failed", stratResult.reason);
  }

  return { text, lessons };
}

/**
 * Log a fact, decision, or outcome to the campaign's memory session.
 * Never throws — memory writes are advisory.
 */
export async function remember(input: RememberInput): Promise<void> {
  try {
    await client().remember({
      session_id: sessionFor(input.grievanceId),
      agent_id: AGENT_ID,
      content: input.content,
      intent: KIND_TO_INTENT[input.kind],
      metadata: input.metadata,
    });
  } catch (e) {
    console.warn("[mubit] remember failed", e);
  }
}

/**
 * Extract durable lessons from a closed campaign. Call once at end of workflow.
 */
export async function reflect(input: { grievanceId: string }): Promise<MubitLesson[]> {
  try {
    const result = await client().reflect({ session_id: sessionFor(input.grievanceId) });
    if (!result || typeof result !== "object") return [];
    const raw = ((result as Record<string, unknown>).lessons ?? []) as unknown[];
    return raw
      .map((l) => toLesson(l, "UK_FLIGHT_DELAY"))
      .filter((l): l is MubitLesson => l !== null);
  } catch (e) {
    console.warn("[mubit] reflect failed", e);
    return [];
  }
}

/**
 * Record the campaign-level outcome. Upweights or downweights every lesson
 * the campaign touched; rationale gets stored alongside for the dashboard.
 */
export async function recordOutcome(input: {
  grievanceId: string;
  outcome: "WON" | "LOST" | "CANCELLED";
  amountRecovered?: number;
}): Promise<void> {
  const mapping = OUTCOME_TO_SIGNAL[input.outcome];
  try {
    await client().recordOutcome({
      session_id: sessionFor(input.grievanceId),
      agent_id: AGENT_ID,
      reference_id: input.grievanceId,
      outcome: mapping.outcome,
      signal: mapping.signal,
      rationale: input.amountRecovered != null
        ? `Outcome=${input.outcome}; amountRecovered=${input.amountRecovered}`
        : `Outcome=${input.outcome}`,
    });
  } catch (e) {
    console.warn("[mubit] recordOutcome failed", e);
  }
}

/**
 * Cross-campaign lessons surfaced for the dashboard's "Lessons Learned" rail.
 * Optional category filter is applied client-side after the SDK returns.
 */
export async function surfaceStrategies(input: {
  category?: GrievanceCategory;
  limit?: number;
}): Promise<MubitLesson[]> {
  try {
    const result = await client().surfaceStrategies({
      lesson_types: ["success", "failure"],
      max_strategies: input.limit ?? 10,
    });
    if (!result || typeof result !== "object") return [];
    const raw = ((result as Record<string, unknown>).strategies ?? []) as unknown[];
    const fallback = input.category ?? "UK_FLIGHT_DELAY";
    const lessons = raw
      .map((l) => toLesson(l, fallback))
      .filter((l): l is MubitLesson => l !== null);
    return input.category
      ? lessons.filter((l) => l.category === input.category)
      : lessons;
  } catch (e) {
    console.warn("[mubit] surfaceStrategies failed", e);
    return [];
  }
}
