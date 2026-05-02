# Tech Stack

Every dependency, why it's chosen, the install command, the doc link.

## Runtime / framework

| Package | Version | Purpose | Doc |
|---------|---------|---------|-----|
| `next` | ^15.1 | App framework. Required for the Vercel-native experience. | https://nextjs.org/docs |
| `react` | ^19 | UI. | https://react.dev |
| `typescript` | ^5.6 | Type safety. Strict mode on. | https://www.typescriptlang.org |

## Vercel agent stack (the chosen track)

| Package | Purpose | Doc |
|---------|---------|-----|
| `workflow` | The Workflow Development Kit. Provides `"use workflow"` and `"use step"` directives. | https://workflow-sdk.dev/docs |
| `@workflow/ai` | `DurableAgent` class — durable AI agents with tool calling, native to WDK. | https://workflow-sdk.dev/docs/api-reference/workflow-ai |
| `ai` (v7) | Vercel AI SDK — model abstractions, tool calling, streaming, MCP client. | https://ai-sdk.dev/docs |
| `@ai-sdk/anthropic` | Anthropic provider for the AI SDK. (Optional — Gateway can route by string too.) | https://ai-sdk.dev/providers |

Install:
```bash
pnpm add next@latest react@latest react-dom@latest workflow @workflow/ai ai @ai-sdk/anthropic
```

## ChatSDK — for the Telegram bot surface

| Package | Purpose | Doc |
|---------|---------|-----|
| `chat` | Vercel ChatSDK core — write bot logic once, deploy to many platforms. | https://chat-sdk.dev/docs |
| `@chat-adapter/telegram` | Telegram platform adapter. | https://chat-sdk.dev/docs/adapters/telegram |
| `@chat-adapter/state-redis` | Redis-backed state for ChatSDK (we'll use Vercel KV underneath). | https://chat-sdk.dev/docs/state |

Install:
```bash
pnpm add chat @chat-adapter/telegram @chat-adapter/state-redis
```

If you want a "ships to Slack too" demo line as a stretch goal:
```bash
pnpm add @chat-adapter/slack
```

## Storage

| Package | Purpose | Doc |
|---------|---------|-----|
| `@vercel/kv` | Key-value store for grievance records, ChatSDK state, deduplication. | https://vercel.com/docs/storage/vercel-kv |

Install:
```bash
pnpm add @vercel/kv
```

For local dev: spin up an Upstash Redis in 30 seconds and put the credentials in `.env.local`.

## Memory layer (Mubit — sponsor)

| Package | Purpose | Doc |
|---------|---------|-----|
| `@mubit-ai/sdk` | Direct client for Mubit. | https://docs.mubit.ai |
| `@mubit-ai/ai-sdk` | Optional: middleware that auto-instruments AI SDK calls. We use the explicit SDK for visibility, but the middleware is a fast win for "auto-learning". | https://docs.mubit.ai/sdk/framework-integrations |

Install:
```bash
pnpm add @mubit-ai/sdk @mubit-ai/ai-sdk
```

## Web data (Bright Data — sponsor)

No npm package — Bright Data exposes its tools via an MCP server URL. We connect to it using the AI SDK's `experimental_createMCPClient`. See `integrations/bright-data.md` for the connection details.

What you DO need:
- A Bright Data account (free tier: 5,000 requests/month).
- The token, set as `BRIGHT_DATA_TOKEN` env var.
- Decide which tool groups to load (we recommend `advanced_scraping,business,social`).

## Email send + receive

| Package | Purpose | Doc |
|---------|---------|-----|
| `resend` | Send emails. Free tier covers the demo easily. | https://resend.com/docs |

Install:
```bash
pnpm add resend
```

You'll also need to set up an inbound webhook in the Resend dashboard pointing at `/api/webhooks/resend`.

## Validation

| Package | Purpose |
|---------|---------|
| `zod` | Schema validation at every external boundary (Telegram payloads, Resend webhooks, user input, AI SDK tool inputs). |

Install:
```bash
pnpm add zod
```

## Styling

| Package | Purpose |
|---------|---------|
| `tailwindcss` | Utility CSS. Already wired by `create-next-app`. |
| `@fontsource/fraunces` | Display font (alternatives in `07_V0_DASHBOARD_PROMPT.md`). |
| `@fontsource/jetbrains-mono` | Mono font for the trace strip. |

Install (fonts):
```bash
pnpm add @fontsource/fraunces @fontsource/jetbrains-mono
```

## What we are deliberately NOT using

| Avoided | Why |
|---------|-----|
| LangChain / LangGraph | WDK + AI SDK is the Vercel-native path. Don't dilute the demo. |
| Pinecone / vector DB | Mubit handles memory. Adding a vector DB doubles the moving parts. |
| Playwright / Puppeteer directly | Bright Data's `scraping_browser_*` tools cover this. Don't reinvent. |
| Custom queues (BullMQ, etc.) | The whole point of WDK is to delete this category of code. |
| Auth (NextAuth, Clerk, etc.) | Single-user demo mode for the hackathon. Add later. |
| ORMs (Prisma, Drizzle) | Vercel KV is plenty for the data shapes we have. |
| Zustand / Redux | Server-first; URL state + KV polling is enough. |
| shadcn/ui | Custom components reinforce the distinctive aesthetic. (See `07_V0_DASHBOARD_PROMPT.md`.) |

## One-liner install for everything

```bash
pnpm add next@latest react@latest react-dom@latest \
  workflow @workflow/ai ai @ai-sdk/anthropic \
  chat @chat-adapter/telegram @chat-adapter/state-redis \
  @vercel/kv \
  @mubit-ai/sdk @mubit-ai/ai-sdk \
  resend zod \
  @fontsource/fraunces @fontsource/jetbrains-mono
```

## Required environment variables

See `.env.example` in repo root. Summary:

- `AI_GATEWAY_API_KEY` (auto on Vercel)
- `MUBIT_API_KEY`
- `BRIGHT_DATA_TOKEN`, `BRIGHT_DATA_PRO=1`, `BRIGHT_DATA_GROUPS=advanced_scraping,business,social`
- `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_INBOUND_ADDRESS`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- `NEXT_PUBLIC_APP_URL`
