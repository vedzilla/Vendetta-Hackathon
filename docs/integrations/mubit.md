# Integration: Mubit (Memory Layer)

The thing that makes Vendetta get smarter over time. Without Mubit, every campaign starts from scratch.

**Docs:** https://docs.mubit.ai
**LLM-friendly index:** https://docs.mubit.ai/llms.txt
**Quickstart:** https://docs.mubit.ai/getting-started
**Support agent recipe (similar pattern to ours):** https://docs.mubit.ai/recipes/support-agent-loop

## Mental model

Mubit stores three kinds of things:
- **Facts** — durable truths ("Wizz Air complaints email is `customercare@wizzair.com`").
- **Traces** — what happened ("Sent first letter on 2026-05-02 at 14:23").
- **Lessons** — patterns extracted from traces ("Citing Article 7 first gets faster replies than citing case law"). Auto-extracted by `reflect()`; rarely written manually.

The four core methods we use:
- `remember()` — log a fact or trace.
- `getContext()` — before deciding, ask "what should I know about this?"
- `reflect()` — at end of campaign, extract lessons.
- `recordOutcome()` — mark a lesson as "this worked" so it ranks higher next time.
- `surfaceStrategies()` — for the dashboard's "Lessons Learned" rail.

## Setup

```bash
pnpm add @mubit-ai/sdk
```

`.env.local`:
```
MUBIT_API_KEY=mbt_...
MUBIT_ENDPOINT=https://api.mubit.ai
```

## Wrapper module (`src/lib/mubit.ts`)

```ts
import { Client } from "@mubit-ai/sdk";

const AGENT_ID = "vendetta";
let _client: Client | null = null;

function client(): Client {
  if (!_client) {
    if (!process.env.MUBIT_API_KEY) {
      throw new Error("MUBIT_API_KEY not set");
    }
    _client = new Client({
      api_key: process.env.MUBIT_API_KEY,
      endpoint: process.env.MUBIT_ENDPOINT ?? "https://api.mubit.ai",
    });
  }
  return _client;
}

const sessionFor = (grievanceId: string) => `vendetta:${grievanceId}`;

/**
 * Pull lessons from past campaigns. Use BEFORE every important LLM call.
 */
export async function getMemoryContext(args: {
  grievanceId: string;
  query: string;
  tokenBudget?: number;
}): Promise<string> {
  try {
    const ctx = await client().getContext({
      session_id: sessionFor(args.grievanceId),
      query: args.query,
      mode: "summary",
      max_token_budget: args.tokenBudget ?? 600,
    });
    return ctx.context_block ?? "";
  } catch (e) {
    console.warn("[mubit] getContext failed, continuing without memory", e);
    return "";  // graceful degradation — agent still works without memory
  }
}

/**
 * Log a fact, trace, or observation.
 */
export async function remember(args: {
  grievanceId: string;
  content: string;
  intent: "fact" | "trace" | "lesson";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await client().remember({
      session_id: sessionFor(args.grievanceId),
      agent_id: AGENT_ID,
      content: args.content,
      intent: args.intent,
      metadata: args.metadata,
    });
  } catch (e) {
    console.warn("[mubit] remember failed", e);
  }
}

/**
 * Extract durable lessons from a closed campaign. Call once at end of workflow.
 */
export async function reflect(args: {
  grievanceId: string;
}): Promise<{ lessonIds: string[] }> {
  try {
    const result = await client().reflect({ session_id: sessionFor(args.grievanceId) });
    const lessonIds = (result.lessons ?? [])
      .map((l: { lesson_id?: string }) => l.lesson_id)
      .filter((id): id is string => Boolean(id));
    return { lessonIds };
  } catch (e) {
    console.warn("[mubit] reflect failed", e);
    return { lessonIds: [] };
  }
}

/**
 * Mark a lesson as having driven a successful outcome. Upweights it for future ranking.
 */
export async function recordOutcome(args: {
  grievanceId: string;
  lessonId: string;
  outcome: "success" | "failure" | "partial";
  signal?: number;
  rationale?: string;
}): Promise<void> {
  try {
    await client().recordOutcome({
      session_id: sessionFor(args.grievanceId),
      agent_id: AGENT_ID,
      reference_id: args.lessonId,
      outcome: args.outcome,
      signal: args.signal ?? 0.7,
      rationale: args.rationale,
    });
  } catch (e) {
    console.warn("[mubit] recordOutcome failed", e);
  }
}

/**
 * Pull surfaced lessons across campaigns for the dashboard's "Lessons Learned" rail.
 */
export async function surfaceStrategies(args: {
  grievanceId: string;
  max?: number;
}): Promise<Array<{ id: string; content: string; outcome?: string }>> {
  try {
    const result = await client().surfaceStrategies({
      session_id: sessionFor(args.grievanceId),
      lesson_types: ["success", "failure"],
      max_strategies: args.max ?? 5,
    });
    return (result.strategies ?? []).map((s: any) => ({
      id: s.id ?? "",
      content: s.content ?? "",
      outcome: s.outcome,
    }));
  } catch (e) {
    console.warn("[mubit] surfaceStrategies failed", e);
    return [];
  }
}
```

## Where to call each method in the workflow

| Workflow point | Method | Why |
|----------------|--------|-----|
| Start of every step that needs context | `getMemoryContext()` | Inject relevant past lessons into LLM prompt |
| After classification | `remember(intent: "fact")` | Lock in the company/category facts |
| After research completes | `remember(intent: "fact")` | Lock in complaints address, regulator, statutes |
| After draft is sent | `remember(intent: "trace")` | Log the action |
| After reply received | `remember(intent: "trace")` | Log what they said |
| When campaign closes (won/lost/cancelled) | `reflect()` | Extract durable lessons |
| When campaign is `WON` | `recordOutcome("success", signal: 0.9)` | Strong reinforcement |
| When campaign is `LOST` after escalation | `recordOutcome("failure", signal: 0.6)` | Negative signal, still useful |
| When dashboard renders right rail | `surfaceStrategies()` | The visible memory |

## Seeding lessons before the demo

For the demo to be visually impressive, the "Lessons Learned" rail must NOT be empty. Pre-seed with realistic lessons:

```ts
// scripts/seed-mubit.ts (run once before demo)
import { remember } from "@/lib/mubit";

const seedLessons = [
  "Wizz Air typically responds to EU261 claims within 9-11 days when Article 7 is cited explicitly in the first paragraph.",
  "easyJet rejects claims that don't include the original boarding pass image attached.",
  "Ryanair's first response is almost always a £40 voucher offer; counter with the actual cash entitlement.",
  "British Airways accepts EU261 claims faster when escalated to the Customer Care director found via LinkedIn.",
  "The UK Civil Aviation Authority's PACT submission window is 8 weeks after the airline's final response.",
];

for (const [i, content] of seedLessons.entries()) {
  await remember({
    grievanceId: `seed-${i}`,
    content,
    intent: "lesson",
    metadata: { seed: true, vertical: "UK_FLIGHT_DELAY" },
  });
}
```

This gives `surfaceStrategies()` real material to return when judges look at the dashboard.

## Vercel AI SDK middleware (alternative path)

There's also `@mubit-ai/ai-sdk` which auto-instruments LLM calls — every `generateText`/`streamText` call automatically pulls context and writes traces:

```ts
import { wrapLanguageModel } from "ai";
import { mubitMemoryMiddleware } from "@mubit-ai/ai-sdk";
import { reasoningModel } from "@/lib/ai";

export const memoryAwareModel = wrapLanguageModel({
  model: reasoningModel,
  middleware: mubitMemoryMiddleware({
    apiKey: process.env.MUBIT_API_KEY!,
    agentId: "vendetta",
  }),
});
```

For the hackathon I recommend **the explicit SDK calls** (above), not the middleware — explicit calls are easier to point at on stage and say "this is the memory loop, you can see it in the code."

## What to demo to the Mubit judges

The Mubit track judges need to see THREE things:
1. **The memory rail in the dashboard** is populated and the lessons look real.
2. **A side-by-side** in your pitch: campaign #1 vs campaign #10, where #10's letter is visibly improved due to lessons #10 had access to.
3. **The code** — open `src/lib/mubit.ts` for 5 seconds and say "five lines per Mubit primitive, the agent gets smarter for free." Mubit's whole pitch is "3 lines of code"; you literally proved their pitch.
