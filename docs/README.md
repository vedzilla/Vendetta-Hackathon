# Vendetta — Handoff Pack

This folder is the complete brief for building Vendetta — solo entry to the **Vercel Zero to Agent** hackathon, London, May 2 2026.

The pack is designed to be dropped into a Next.js repo as `docs/` (with `CLAUDE.md` at the repo root), then handed to Claude Code (and optionally Codex) to execute against in parallel.

## What's in this pack

| File | Read for |
|------|----------|
| **`CLAUDE.md`** *(belongs at REPO ROOT, not in docs/)* | Behavioural priming for Claude Code. Sets hard rules and points to the other docs. |
| `00_PRD.md` | The product spec. Functional + non-functional requirements, scope, risks. |
| `01_BUILD_PLAN.md` | Hour-by-hour Saturday timing. Includes the dual-terminal split for Claude Code + Codex. |
| `02_TECH_STACK.md` | Every dependency, why, doc link, install command. |
| `03_ARCHITECTURE.md` | Folder layout, data model, workflow shape, API surfaces, system diagram. |
| `04_GRIEVANCE_VERTICAL_EU261.md` | Legal + operational knowledge the agent needs. The seed material for Mubit. |
| `05_DEMO_SCRIPT.md` | The 3-minute pitch, beat by beat. |
| `06_JUDGING_STRATEGY.md` | How each feature maps to the rubric and to each sponsor. |
| `07_V0_DASHBOARD_PROMPT.md` | Ready-to-paste v0 prompt with strong aesthetic direction. |
| `08_SUBMISSION_CHECKLIST.md` | What to file in each prize pool. |
| **`09_DEMO_MODE.md`** | **Time-warp demo design + three scripted scenarios + seeded backdrop. The pitch's centerpiece.** |
| `integrations/vercel-wdk.md` | Workflow SDK code patterns. |
| `integrations/mubit.md` | Memory layer code patterns. |
| `integrations/bright-data.md` | Web scraping MCP patterns. |
| `integrations/chat-sdk-telegram.md` | Telegram bot + voice notes. |
| `integrations/ai-gateway.md` | LLM routing (mandatory). |
| `integrations/resend.md` | Outbound + inbound email. |

## How to use it

### Step 1 — Set up the repo (Friday night, ~30 minutes)

```bash
# Create the project
npx create-next-app@latest vendetta --typescript --tailwind --app --no-src-dir false
cd vendetta

# Drop this entire docs folder + CLAUDE.md
cp -r ~/Downloads/vendetta-docs ./docs
mv ./docs/CLAUDE.md ./CLAUDE.md   # CLAUDE.md goes at the root

# Install dependencies (see 02_TECH_STACK.md for the full list)
pnpm add next@latest react@latest react-dom@latest \
  workflow @workflow/ai ai @ai-sdk/anthropic \
  chat @chat-adapter/telegram @chat-adapter/state-redis \
  @vercel/kv \
  @mubit-ai/sdk @mubit-ai/ai-sdk \
  resend zod \
  @fontsource/fraunces @fontsource/jetbrains-mono

# Wrap next.config (see integrations/vercel-wdk.md)
# (manually edit next.config.ts to wrap with withWorkflow)

# Commit + push to a private GitHub repo
git init
git add .
git commit -m "scaffold + handoff pack"
git remote add origin git@github.com:you/vendetta.git
git push -u origin main

# Link the repo to Vercel
npx vercel link
npx vercel deploy --prod   # confirms deploy pipeline works
```

### Step 2 — Brief the agents (Saturday morning, before hacking starts)

In **Terminal 1 (Claude Code)**:

> Read CLAUDE.md and all files in docs/. You're building Vendetta. We start now. Begin Block A → Terminal 1 from docs/01_BUILD_PLAN.md. You own everything in src/types/, src/lib/, and src/workflows/. Do not touch anything in src/components/ or src/app/ — those belong to the other terminal. Start by creating the Grievance type, then the lib wrappers, then the workflow shell. Push to a branch called `t1-backend` every 30 minutes.

In **Terminal 2 (Codex)**:

> Read docs/CLAUDE.md and all files in docs/. You're building Vendetta. We start now. Begin Block A → Terminal 2 from docs/01_BUILD_PLAN.md. You own everything in src/app/ (pages, layouts, API routes) and src/components/. Import types from src/types/grievance.ts and lib functions from src/lib/* — Terminal 1 owns those, do not modify them. Start with the dashboard shell using docs/07_V0_DASHBOARD_PROMPT.md as design direction, then the Telegram webhook handler. Push to a branch called `t2-frontend` every 30 minutes.

### Step 3 — Merge cadence

You (the human) merge both branches into `main` at every sync point listed in `01_BUILD_PLAN.md`:
- 13:00 (lunch)
- 17:00 (end of Block B)
- 19:00 (end of Block C)

If a merge conflict happens at any other time, it means the file ownership rules in `01_BUILD_PLAN.md` were violated. Fix the violation, don't paper over the merge.

## Key decisions that have already been made (don't relitigate)

| Decision | Choice | Why |
|----------|--------|-----|
| Track | Track 1 (Vercel Workflow SDK) | Highest technical depth, least crowded |
| Grievance vertical for v1 | UK Flight Delay (EU261/UK261) | Well-defined rules, demo-relatable |
| Messaging surface | Telegram via ChatSDK | Fastest setup, voice-note native, looks like iMessage |
| LLM routing | Vercel AI Gateway | Mandatory — judges check |
| Reasoning model | `anthropic/claude-opus-4-7` | Most capable available |
| Fast model | `anthropic/claude-sonnet-4-6` | For classification / extraction |
| Storage | Vercel KV | Simplest, Vercel-native |
| Email | Resend | Free tier, clean SDK, inbound webhooks |

## What success looks like at 19:30 Saturday

- Live deployment at `vendetta.vercel.app`.
- Telegram bot responding to text and voice.
- Dashboard with ≥ 3 seeded campaigns and ≥ 5 lessons in the right rail.
- Vercel `/workflows` showing real workflow runs.
- 60–90 second demo video pinned to the README.
- Submitted to BOTH prize pools.
- 3-minute pitch rehearsed three times to under 2:50.

## What success looks like by 20:30 Saturday

- 1st place in the Main track (£2.5k cash + credits).
- Winner of the Mubit track ($100k credits).
- Bright Data overall winner kicker ($1k credits).

## What success looks like by May 4

- Top 3 in the Vercel global community vote.

---

Built (in spec form) on May 1 2026. Execute on May 2.
