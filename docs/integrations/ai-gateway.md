# Integration: Vercel AI Gateway

One endpoint, all models, no API key juggling. **Every LLM call in Vendetta routes through this.** Don't bypass it.

**Docs:** https://vercel.com/ai-gateway
**Models list:** https://vercel.com/ai-gateway/models
**AI SDK docs:** https://ai-sdk.dev/docs

## Why

- **One endpoint** for OpenAI, Anthropic, Google, xAI, etc.
- **Automatic failover** between providers if one is down.
- **No individual API keys** — just one Gateway key (or zero, if deployed on Vercel via OIDC).
- **Cost tracking** in one place.
- **Vercel judges check for this.** They will look at your code.

## Setup

```bash
pnpm add ai
```

For local dev, get a key from `https://vercel.com/ai-gateway` and put it in `.env.local`:
```
AI_GATEWAY_API_KEY=ag_...
```

When deployed to Vercel, this is **auto-injected via OIDC** — no key needed.

## Model exports (`src/lib/ai.ts`)

```ts
import { gateway } from "ai";

/**
 * REASONING MODEL — Claude Opus 4.7 (most capable available).
 * Use for: legal analysis, draft generation, complex decisions, escalation logic.
 */
export const reasoningModel = gateway("anthropic/claude-opus-4-7");

/**
 * FAST MODEL — Claude Sonnet 4.6.
 * Use for: classification, fact extraction, intent detection, simple summaries.
 */
export const fastModel = gateway("anthropic/claude-sonnet-4-6");

/**
 * TRANSCRIPTION — Whisper for Telegram voice notes.
 */
export const transcriptionModel = gateway("openai/whisper-1");
```

## Usage patterns

### Simple text generation

```ts
import { generateText } from "ai";
import { fastModel } from "@/lib/ai";

const { text } = await generateText({
  model: fastModel,
  prompt: "Classify this grievance into a category: ...",
});
```

### Structured output (Zod)

```ts
import { generateObject } from "ai";
import { z } from "zod";
import { fastModel } from "@/lib/ai";

const { object } = await generateObject({
  model: fastModel,
  schema: z.object({
    category: z.enum(["UK_FLIGHT_DELAY", "PARKING_FINE", "OTHER"]),
    company: z.string(),
    incidentDate: z.string().optional(),
    confidence: z.number().min(0).max(1),
  }),
  prompt: `User's grievance: "${grievance.rawDescription}". Extract structured details.`,
});
```

### Streaming for the dashboard / Telegram

```ts
import { streamText } from "ai";
import { reasoningModel } from "@/lib/ai";

const result = streamText({
  model: reasoningModel,
  prompt: draftPrompt,
});

for await (const chunk of result.textStream) {
  await writable.write({ delta: chunk });
}
```

### With tools (DurableAgent path)

This is what the research and reply-classification steps use. See `vercel-wdk.md` and `bright-data.md` for the full pattern.

## Cost discipline

For a hackathon you have plenty of credits — but design defensively:

- Use `fastModel` (Sonnet) for anything that doesn't need deep reasoning. ~10x cheaper, ~3x faster.
- Use `reasoningModel` (Opus) only for: drafting letters, classifying complex replies, escalation decisions.
- Keep system prompts under 800 tokens. Mubit context is already injected; don't duplicate.
- Stream where the user is watching. Don't stream where the workflow is running headless.

## Auth on Vercel

When deployed:
1. Vercel auto-injects `AI_GATEWAY_API_KEY` for any model call from your project.
2. OIDC tokens scoped per deployment — no leaking across projects.
3. No code changes needed — just deploy.

If you see auth errors on Vercel: check that "AI Gateway" is enabled in your project settings → Integrations.
