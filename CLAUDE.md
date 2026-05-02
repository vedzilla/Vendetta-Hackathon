# CLAUDE.md — Vendetta

You are working on **Vendetta**, a solo entry to the **Vercel Zero to Agent** hackathon (London, May 2 2026). The host is Oscar (`@oscarfalll`). The local prize pool closes at 19:30 the same day; the global Vercel community vote closes May 4.

## What you're building, in one sentence

An autonomous agent that pursues a real consumer grievance — flight delay compensation under EU261/UK261 — for weeks at a time, without supervision, getting smarter at it on every campaign.

## Read these in order before writing any code

1. **`docs/00_PRD.md`** — what we're building and why. Source of truth for product decisions.
2. **`docs/01_BUILD_PLAN.md`** — hour-by-hour build sequence. Includes the dual-terminal split if Codex is also working in parallel.
3. **`docs/02_TECH_STACK.md`** — every dependency, why it's chosen, the doc link, the install command.
4. **`docs/03_ARCHITECTURE.md`** — folder layout, data model, workflow shape, API surfaces. Don't deviate from the structure here without flagging it.
5. **`docs/integrations/*.md`** — one file per external service (Mubit, Bright Data, ChatSDK, AI Gateway, Resend, Vercel WDK). These have actual code patterns. **Read the relevant one before integrating that service.**
6. **`docs/04_GRIEVANCE_VERTICAL_EU261.md`** — the legal/business knowledge the agent needs. This is the seed knowledge for Mubit memory.
7. **`docs/09_DEMO_MODE.md`** — time-warp demo design. The three scripted scenarios live here. **Demo mode is not a stretch goal — it's the pitch. Build it in Block B alongside the workflow body.**
8. **`docs/05_DEMO_SCRIPT.md`** — what we're going to show on stage. Every feature must serve this script.
9. **`docs/06_JUDGING_STRATEGY.md`** — the judging rubric and how each feature earns marks. If a feature doesn't map to this, deprioritise it.
10. **`docs/07_V0_DASHBOARD_PROMPT.md`** — the prompt to feed v0 for the dashboard scaffold.
11. **`docs/08_SUBMISSION_CHECKLIST.md`** — what to file in each prize pool.
12. **`docs/09_DEMO_MODE.md`** — the demo system: time-warp architecture, the dev panel, three scripted scenarios with word-for-word simulated airline replies, seeded multi-vertical campaigns. The simulated airline reply text in this file is canonical; do not rewrite it.

## Hard rules

- **Track 1 (Vercel Workflow SDK) is the chosen track.** Do not pivot to Track 2 or Track 3. We use ChatSDK *on top of* WDK, not as the primary track.
- **Every LLM call routes through Vercel AI Gateway.** No direct Anthropic/OpenAI keys. Model strings only: `'anthropic/claude-opus-4-7'`, `'anthropic/claude-sonnet-4-6'`.
- **The `"use workflow"` and `"use step"` directives are how durability is achieved.** Do not write your own queues, retry loops, or state machines.
- **Mubit must be visible in the demo.** The "Lessons Learned" panel on the dashboard is mandatory, not optional. Wire `getContext()` before every important LLM call and `reflect()` after every campaign closes.
- **Bright Data MCP must be the agent's only web-access path.** Don't add `fetch()` calls to scrape pages. The agent picks Bright Data tools via the AI SDK's tool interface.
- **Demo mode is a first-class feature, not a hack.** The workflow accepts `{ demo: { timeScale: number } }` as input metadata. Sleeps are scaled by `timeScale` only inside the workflow; everything else runs the real code path. Synthetic replies are injected via the same Resend inbound webhook real replies use — the workflow has no awareness of which is which.
- **Multi-vertical appearance, single-vertical execution.** Only `UK_FLIGHT_DELAY` runs live workflows. `PARKING_FINE` and `SUBSCRIPTION_CANCELLATION` campaigns are static seeded records for demo credibility. Do not attempt to wire a live workflow for the seeded categories — that's a post-hackathon feature.
- **Stack ranking when scope-cutting:** durability + memory loop > Telegram bot > **demo mode + scenarios** > dashboard polish > additional verticals. Cut from the right, never the left.
- **No localStorage/sessionStorage in the dashboard.** Vercel KV or React state only.
- **Commit small, commit often.** Every working feature gets pushed. Vercel's preview deploys are part of the demo.

## Coding standards

- TypeScript strict mode. No `any` unless you justify it in a comment.
- Server-first. Use server actions and route handlers; minimise client components.
- Tailwind for styles. No CSS-in-JS libraries.
- Zod schemas for every external boundary (Telegram payloads, Resend webhooks, user input).
- Comments explain *why*, not *what*.

## When you're stuck

- The Vercel docs are at `https://vercel.com/docs`, the WDK docs at `https://workflow-sdk.dev/docs`, the AI SDK docs at `https://ai-sdk.dev/docs`. Fetch these directly rather than guessing.
- The full AI SDK reference exists as a single Markdown file at `https://ai-sdk.dev/llms.txt` — pull that into context if you need broad coverage.
- Mubit docs index: `https://docs.mubit.ai/llms.txt`. Bright Data docs index: `https://docs.brightdata.com/llms.txt`.

## What "done" looks like for tomorrow

- Live deployment on `vendetta.vercel.app` (or similar).
- A user can open Telegram, send a voice note describing a flight delay, and within 30 seconds get back a structured response with an "Approve to Send" card.
- The web dashboard at the deployment URL shows at least 3 active campaigns with their full timelines and Mubit lessons surfaced.
- The Vercel observability tab on `/workflows` shows real workflow runs with non-trivial step traces.
- Submission filed to **both** prize pools (local Notion form + Vercel community page).

Last updated: pre-event setup, May 1 2026.
