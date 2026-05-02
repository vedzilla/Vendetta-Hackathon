# Build Plan — Hour by Hour, with Dual-Terminal Split

This is the execution sequence. It assumes you have **two AI coding agents working in parallel** (Claude Code as Terminal 1, Codex as Terminal 2). The work is split so they touch **disjoint files** and never conflict on the same path.

## How the dual-terminal pattern works (read first)

Two coding agents on one repo can step on each other's commits in seconds if you're not careful. The pattern that prevents this is **git worktrees plus disjoint file ownership**.

A worktree is a second checkout of the same repo, on a different branch, in a separate folder. Both folders share the same `.git` underneath, so commits and pulls flow between them — but the working files are physically separate. Two agents in two folders cannot collide.

Combined with a strict file-ownership rule (Terminal 1 owns `src/types/`, `src/lib/`, `src/workflows/`; Terminal 2 owns `src/app/`, `src/components/`), you get genuine parallelism: each agent works in its own world, and you (the human) merge their branches at scheduled sync points.

### Worktree setup (run once Friday night, after the initial commit)

```bash
cd ~/vendetta                           # main checkout, currently on `main`
git checkout -b t1-backend               # main checkout becomes Terminal 1's branch
git worktree add ../vendetta-fe -b t2-frontend
```

You now have:
- `~/vendetta` on branch `t1-backend` → Claude Code's terminal
- `~/vendetta-fe` on branch `t2-frontend` → Codex's terminal

### Make both agents read the same brief

Codex looks for `AGENTS.md`; Claude Code looks for `CLAUDE.md`. Symlink them:

```bash
cd ~/vendetta
ln -s CLAUDE.md AGENTS.md
git add AGENTS.md && git commit -m "symlink AGENTS.md → CLAUDE.md"
```

The symlink propagates to the worktree automatically.

### Merge cadence

At every sync point (lunch, 17:00, 19:00) — and ideally every 30 minutes during a block — you do:

```bash
cd ~/vendetta
git checkout main
git merge t1-backend
git merge t2-frontend
git push

# then in each worktree, rebase onto the new main
cd ~/vendetta && git checkout t1-backend && git rebase main
cd ../vendetta-fe && git rebase main
```

If a merge conflict appears, that's a signal that file ownership was violated — find the offending file, decide who owns it, and re-establish the rule.

### Three pitfalls to pre-empt

1. **`package.json` is shared.** Designate Claude Code (Terminal 1) as the only agent that runs `pnpm add`. If Codex needs a frontend lib, it writes a TODO and you (or T1) install it. This avoids duplicate-install merge headaches.
2. **The frontend will reference backend exports that don't exist yet.** Terminal 1 should *stub them first* — empty functions with the correct type signatures — so Terminal 2 can compile against the contract while T1 fills in the bodies.
3. **`.env.local` is gitignored and per-folder.** When you get the API keys Saturday morning, paste them into `~/vendetta/.env.local` once, then `cp .env.local ../vendetta-fe/`.

---

## Pre-event checklist (Friday night)

| # | Task | Time | Why |
|---|------|------|-----|
| 1 | Create private GitHub repo `vendetta` | 5 min | Source of truth |
| 2 | Drop this entire `docs/` folder + the `CLAUDE.md` at repo root | 2 min | Context for both agents |
| 3 | Run `npx create-next-app@latest vendetta --typescript --tailwind --app --no-src-dir false` to scaffold the Next.js skeleton | 5 min | Don't waste hackathon time on this |
| 4 | Install dependencies per `02_TECH_STACK.md` | 5 min | Same |
| 5 | Wrap `next.config.ts` with `withWorkflow` per `integrations/vercel-wdk.md` | 2 min | One-time WDK setup |
| 6 | Create `.env.local` with placeholder values from `.env.example` | 2 min | Shape ready for Saturday's keys |
| 7 | Initial commit + push + Vercel project link | 5 min | Confirms deploy path works |
| 8 | **Set up the worktree split** (see "How the dual-terminal pattern works" above) | 3 min | Pre-empt all merge headaches |
| 9 | **Symlink `AGENTS.md` → `CLAUDE.md`** so Codex reads the brief | 1 min | Both agents need the same context |
| 10 | Create Telegram bot via @BotFather, save token | 5 min | One less thing to do Saturday |
| 11 | Create Resend account, verify a domain (or note fallback) | 10 min | DNS propagation can take hours |
| 12 | Create empty Mubit, Bright Data, Vercel AI Gateway accounts | 5 min | Even without keys, accounts exist |
| 13 | **Pre-script the three demo scenarios** in `09_DEMO_SCENARIOS.md` | 30 min | Already done — just review and adjust voice notes / replies to your taste |

Total Friday prep: ~75 minutes.

---

## Saturday timing

| Block | Real time | Activity |
|-------|-----------|----------|
| Arrival | 10:00–11:00 | Coffee, network, settle |
| Intro | 11:00–11:30 | Listen to Oscar's intro, get credit links |
| Hacking | 11:30–13:00 | Block A (1.5h) — Foundation |
| Lunch | 13:00–13:30 | Eat. Don't skip. |
| Hacking | 13:30–17:00 | Block B (3.5h) — Core build |
| Hacking | 17:00–19:00 | Block C (2h) — Demo polish |
| Hacking ends | 19:30 | Submit + practice pitch |
| Winners | 20:30 | Announce |

**Effective build time: ~7 hours.** Plan to ship the core in 5, leaving 2 hours for polish and demo prep.

---

## Block A (11:30–13:00) — Foundation

Both terminals start in parallel. Goal: at the end of this block, both surfaces (Telegram and Web) can receive a grievance, classify it, and persist a grievance record.

### Terminal 1 (Claude Code) — Backend foundation

Files to create:
```
src/types/grievance.ts
src/lib/ai.ts
src/lib/mubit.ts
src/lib/brightdata.ts
src/lib/resend.ts
src/lib/store.ts          # KV-backed grievance store
src/workflows/pursue-grievance.ts   # SHELL ONLY, real logic in Block B
src/workflows/steps/classify.ts
src/workflows/steps/extract-facts.ts
```

Claude Code prompt to start with:
> Read CLAUDE.md and docs/00_PRD.md, then implement the files listed in Block A → Terminal 1 of docs/01_BUILD_PLAN.md. Use the integration patterns from docs/integrations/. Stub out anything that depends on Block B work (the workflow body) but type it correctly.

### Terminal 2 (Codex) — Frontend foundation + Telegram bot

Files to create:
```
src/app/page.tsx                     # dashboard shell
src/app/layout.tsx                   # fonts, theme, etc.
src/app/globals.css                  # design tokens per docs/07
src/components/CampaignList.tsx
src/components/CampaignDetail.tsx
src/components/LessonsRail.tsx
src/components/ActivityTicker.tsx
src/app/api/webhooks/telegram/route.ts   # Telegram webhook handler
src/app/api/grievances/route.ts          # POST to start a workflow from web
```

Codex prompt:
> Read docs/00_PRD.md, docs/03_ARCHITECTURE.md, docs/07_V0_DASHBOARD_PROMPT.md, and docs/integrations/chat-sdk-telegram.md. Build the files listed in Block A → Terminal 2. Import types from src/types/grievance.ts (Terminal 1 owns this) and use the lib functions from src/lib/* (Terminal 1 also owns these). For now, mock the workflow trigger — Block B will replace the mock with the real workflow start.

### Sync point at 13:00 (lunch)

Both terminals push. You merge. Quick smoke test:
- `pnpm dev` runs cleanly.
- Posting a JSON body to `POST /api/grievances` creates a record.
- Sending `/start` to the Telegram bot gets a "hello" reply.

If either fails, this is the moment to reset before lunch.

---

## Block B (13:30–17:00) — Core build

This is the meat. The workflow logic, the Mubit memory loop, the Bright Data integration, the email send + reply handling.

### Terminal 1 (Claude Code) — The workflow body + demo orchestration

Implement the complete `src/workflows/pursue-grievance.ts`:

```ts
async function pursueGrievance(input: { grievanceId: string; demoScale?: number; isEscalation?: boolean }) {
  "use workflow";
  const scale = input.demoScale ?? 1;

  const grievance = await loadGrievance(input.grievanceId);          // step
  const memory = await getMemoryContext({ grievanceId: input.grievanceId, query: ... }); // step

  const research = await researchTarget(grievance, memory);           // step (uses Bright Data)
  await saveResearch(input.grievanceId, research);                    // step

  const draft = await draftLetter(grievance, research, memory);       // step (Claude Opus)
  const approval = await waitForApproval(input.grievanceId, draft);   // hook
  if (approval.action === "cancel") { await markCancelled(...); return; }
  if (approval.action === "edit") { /* recurse with edits */ }

  await sendEmail(input.grievanceId, draft);                          // step (Resend)
  await markStatus(input.grievanceId, "AWAITING_REPLY");              // step

  const reply = await waitForReplyOrDeadline({                        // hook + demoSleep
    grievanceId: input.grievanceId,
    deadline: "14 days",
    demoScale: scale,
  });

  if (!reply) {
    return pursueGrievance({ ...input, isEscalation: true });
  }

  const decision = await classifyReply(reply, memory);                // step
  // branch on ACCEPTANCE / PARTIAL_OFFER / REJECTION ...

  // On terminal state:
  await reflect({ grievanceId: input.grievanceId });                  // step
  await recordOutcome({ grievanceId: input.grievanceId, ... });       // step
}
```

Pair this with the steps in `src/workflows/steps/`:
- `research.ts` (Bright Data tool calls)
- `draft.ts` (LLM with tool calling)
- `send.ts` (Resend)
- `wait-for-reply.ts` (hooks + `demoSleep` + webhook)
- `classify-reply.ts`
- `escalate.ts`

**ALSO in Block B (critical, not stretch):** Build demo mode infrastructure per `docs/09_DEMO_MODE.md`:
- `src/lib/demo-sleep.ts` — the `demoSleep()` helper
- `src/lib/demo-scenarios.ts` — the three scripted scenarios as TypeScript constants (full text already in 09)
- `src/lib/seeded-campaigns.ts` — the multi-vertical fake campaigns
- `src/workflows/simulate-replies.ts` — the parallel reply-simulator workflow
- `src/app/api/demo/run/route.ts` — the orchestrator endpoint

The demo mode IS the pitch. Treat it as a hard requirement, not a polish item.

### Terminal 2 (Codex) — Telegram bot completion + dashboard wiring + demo UI

- Voice-note transcription (`whisper-1` via AI Gateway).
- Approval-card rendering (Telegram inline keyboards via ChatSDK Cards).
- Live dashboard updates (poll-based or KV-subscribe; keep it simple — `setInterval` 3s for the hackathon).
- The "View Workflow Trace" deep-link to Vercel observability.
- **The dev panel** with three scenario buttons (Easy Win / Negotiation / Escalation) — this is the demo lifeline. See `docs/09_DEMO_MODE.md` § "The dev panel".
- **The FAST FORWARD overlay** on campaign cards in demo mode.
- **The lesson fade-in animation** on the right rail when new lessons arrive.
- **Multi-vertical seeding** at boot — load the static campaigns from `src/lib/seeded-campaigns.ts` into KV on first run so the dashboard isn't empty.

### Inbound webhook (one of you owns this)

`src/app/api/webhooks/resend/route.ts` — receives email replies, parses, and resumes the workflow via `webhookHook.invoke({ ... })`. This is the most fiddly piece. Either terminal can take it; assign it explicitly.

### Sync point at 17:00

Smoke test: end-to-end campaign in <2 minutes (use the dev "fast-forward" toggle that sets sleep durations to seconds).

---

## Block C (17:00–19:00) — Demo polish

Now you optimize for the 3-minute pitch.

### Tasks in priority order

1. **Run all three demo scenarios end-to-end at least three times each.** This is the highest-priority test, not a nice-to-have. If a scenario fails on stage you have nothing to show. Time each one — they should be 25s / 50s / 80s respectively. If they're running long, increase `DEMO_SCALE`.
2. **Start your two real campaigns Friday-evening-style.** If you didn't do this Friday, do it now at scale 60 — by 19:00 you'll have ~10 days of progress on each. These are the "real" campaigns that anchor the seeded-fakes story per `docs/09_DEMO_MODE.md`.
3. **Confirm the seeded fakes load** — open the dashboard in incognito, make sure all 5 campaigns (2 real, 3 fake) appear in the left rail with sensible statuses.
4. **Mubit lessons must be visible.** If the right rail is empty, manually `remember()` the seed lessons listed in `docs/04_GRIEVANCE_VERTICAL_EU261.md` to give the LLM real material.
5. **Polish the dashboard.** Spacing, typography, the FAST FORWARD overlay timing, the lesson fade-in stagger.
6. **Practice the live pitch three times.** Time yourself with each of the three scenarios. Pick which one to use based on which you're most confident in by 18:00.
7. **Record the backup video** of the Escalation scenario per `docs/09_DEMO_MODE.md` § "The backup video". 90 seconds, captions only, MP4 on local laptop.
8. **Write the README.md** for the public repo. Pin the demo video. Add the architecture diagram.
9. **Submit to both pools** by 19:30:
   - Local: https://oscarama.notion.site/352f4900574780f1a8c8f330080c4af8
   - Global: https://community.vercel.com/hackathons/zero-to-agent

---

## Stretch goals (only if Block C finishes before 18:30)

In strict priority order, do them one at a time:

1. **Cards in the dashboard for "Lessons" linking back to the source campaign.**
2. **A second messaging adapter** (Slack via ChatSDK — the same agent now runs in both Slack and Telegram). This is a free demo line: "and it ships to Slack too."
3. **Poke recipe registration.** Vendetta becomes available as a Poke recipe via MCP. Demo line: "or you can text Poke."
4. **A second grievance vertical** (parking fines or refund disputes) wired up with seed Mubit lessons.

If you're past 18:30 and tempted to start a stretch goal: don't. Polish what you have.

---

## Conflict-avoidance rules for parallel terminals

- **Each terminal owns specific files.** No exceptions. If you discover a need to edit a file owned by the other terminal, write a TODO and hand it back.
- **Common types live in `src/types/`** — Terminal 1 owns; Terminal 2 imports.
- **Common helpers live in `src/lib/`** — Terminal 1 owns; Terminal 2 imports.
- **Page / component / API route files** — Terminal 2 owns.
- **Workflow / step files** — Terminal 1 owns.
- **Push frequently** (every 30 minutes minimum) so you spot drift early.
- **One human merges.** Don't let either agent merge to `main`. You merge after a quick read.

---

## What "shipped" means

By 19:00, this is true:

- [ ] `vendetta.vercel.app` is live and responsive on a phone.
- [ ] `@VendettaAgentBot` (or your name) is live on Telegram, accepts text and voice notes.
- [ ] All three demo scenarios (Easy Win / Negotiation / Escalation) run end-to-end without error in their target times (~25s / ~50s / ~80s).
- [ ] The dashboard shows ≥ 5 campaigns spanning at least 3 categories (2 live UK_FLIGHT_DELAY, 3 seeded fakes).
- [ ] Vercel `/workflows` dashboard shows ≥ 3 workflow runs with non-trivial steps. Click into one — the trace must look real.
- [ ] Mubit lessons rail shows ≥ 5 distinct lessons spanning multiple categories.
- [ ] FAST FORWARD overlay renders correctly during compressed sleeps.
- [ ] New lessons fade into the right rail during demo runs.
- [ ] Backup video of the Escalation scenario lives on the local laptop and plays cleanly.
- [ ] Public GitHub repo readme has the demo video pinned.
- [ ] Both submissions filed.
