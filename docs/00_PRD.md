# Vendetta — Product Requirements Document

**Status:** Draft for hackathon execution
**Author:** Pre-event spec
**Owner:** Solo build
**Target ship date:** Saturday May 2 2026, 19:30 BST (local prize pool deadline)
**Version:** 1.0

---

## 1. Problem

Most consumers in the UK are owed money by companies they will never claim it from. The reasons are not legal — the reasons are operational:

1. The grievance process is multi-week and feels like a part-time job.
2. By day three, you forget what you sent and stop following up.
3. Each company designs their complaint flow to be confusing and slow.
4. Escalating to a regulator requires research nobody has time to do.
5. Each new grievance starts from zero — none of your past wins inform the next.

The legal entitlements are real (EU261/UK261 alone is worth ~£200–£600 per delayed flight, and ~30% of UK passengers are eligible at least once per year), but the friction means **less than 1 in 5 valid claims are ever filed**.

## 2. Vision

> **Vendetta is your unpaid junior solicitor.** You describe a grievance once. Vendetta pursues it autonomously for weeks — drafting letters, citing the right statutes, sleeping until response deadlines, escalating when ignored, and getting smarter with every campaign.

The user's only jobs are: describe the grievance once, approve outgoing messages with one tap, and bank the refund.

## 3. Why now (technical)

Vendetta is impossible without three primitives that all became production-ready in the past six months:

- **Vercel Workflow SDK** (GA April 2026) — durable async functions that survive deploys, sleep for weeks, resume from exact step boundaries. Without this, "pursue a grievance for 3 weeks" requires a queue + worker + cron + status table; with this, it's one TypeScript file.
- **Mubit** — managed memory layer that extracts reusable lessons from past agent runs. Without this, every new campaign starts dumb.
- **Bright Data MCP** — 50 pre-built web scraping tools exposed via Model Context Protocol. Without this, the agent can't find the right complaints address for each company / regulator.

Vendetta is the application that makes all three sing together.

## 4. Users & use cases

### Primary persona: "Frustrated Frankie"

UK resident, 25–55, has been wronged by a company in the last 12 months and gave up. Likely candidates: delayed flight passengers, parking-fine recipients, subscription cancellation victims, refund-dispute survivors, deposit-disputing tenants.

### Primary use case for v1 (hackathon scope)

Frankie's flight from Luton to Budapest was delayed 4 hours. They open Telegram, send a voice note describing what happened. Vendetta classifies it as an EU261/UK261 case, calculates eligibility (~£220), drafts a complaint letter to Wizz Air citing the right articles, and asks Frankie to approve. They tap "Approve". Vendetta sends, sleeps for 14 days (legal response window), wakes when a reply arrives, and either accepts the offered settlement, counter-negotiates, or escalates to the Civil Aviation Authority.

### Secondary use cases (post-hackathon, mentioned in pitch)

- Parking fine appeals → POPLA/IAS escalation
- SaaS subscription that won't let you cancel → CMA escalation
- Section 75 chargeback disputes → financial ombudsman
- Tenant deposit disputes → TDS/DPS/mydeposits
- GDPR data-deletion requests being ignored → ICO escalation

## 5. Functional requirements

### F1. Grievance intake (TWO surfaces, one backend)

**F1.1** A user can submit a grievance via **voice note or text** in a Telegram chat with the @VendettaAgentBot bot.
**F1.2** A user can submit a grievance via the **web dashboard's** "New Campaign" form.
**F1.3** Voice notes are transcribed automatically using Whisper (via AI Gateway). Transcript is shown to the user before classification proceeds.
**F1.4** The agent acknowledges receipt within 3 seconds with a typing indicator while it works.

### F2. Classification & extraction

**F2.1** Within 10 seconds of intake, the agent must classify the grievance into one of the supported categories (v1: `UK_FLIGHT_DELAY` only, scaffolded to add others).
**F2.2** The agent extracts structured facts from the description: company name, incident date, reference numbers, amount claimed, currency.
**F2.3** Missing critical facts trigger a follow-up question to the user (e.g. "What was your booking reference?").

### F3. Research

**F3.1** Using Bright Data MCP, the agent must autonomously discover:
  - The company's official complaints email address.
  - The relevant regulator (e.g. UK Civil Aviation Authority for flight delays).
  - The correct statutes/articles to cite.
  - Optionally: the LinkedIn profile of the company's customer-experience director, for escalation copy.
**F3.2** Research results are cached in the grievance record so subsequent runs don't re-scrape.
**F3.3** Mubit `getContext()` is called BEFORE the research step so prior campaigns' learned facts (e.g. "Wizz Air complaints email is X") are reused.

### F4. Letter drafting

**F4.1** The agent drafts a complaint letter using `claude-opus-4-7` via AI Gateway.
**F4.2** The draft must cite the relevant statute by article number (e.g. "Regulation EC 261/2004, Article 7(1)(b)") — verifiable, not hallucinated.
**F4.3** Tone is firm-but-polite by default; user can request "more aggressive" or "more conciliatory" via Telegram replies.

### F5. Human-in-the-loop approval

**F5.1** Before any outbound email is sent, the user receives an interactive Telegram card with the full draft and three buttons: **Approve & Send**, **Edit**, **Cancel**.
**F5.2** If "Edit" is tapped, the user can dictate / type changes and a revised draft is generated.
**F5.3** Implementation uses WDK's `Hooks` primitive — the workflow pauses on a hook waiting for the approval signal, with no compute consumed during the wait.

### F6. Send & wait

**F6.1** Approved letters are sent via Resend, from a verified domain, to the discovered complaints address.
**F6.2** A reply-to address routes inbound replies to a Resend webhook.
**F6.3** The workflow then sleeps using `sleep("14 days")` (configurable per regulator).
**F6.4** When the company replies before the deadline, the inbound webhook resumes the workflow immediately via a hook.

### F7. Reply handling & negotiation

**F7.1** When a reply arrives, the agent classifies it as: `ACCEPTANCE`, `PARTIAL_OFFER`, `REJECTION`, `REQUEST_FOR_INFO`, or `OTHER`.
**F7.2** For `PARTIAL_OFFER`, the agent decides (using past lessons from Mubit) whether to accept or counter. User is notified with the recommendation and given final say.
**F7.3** For `REJECTION` or no-reply-after-deadline, the agent escalates to the regulator automatically.

### F8. Escalation

**F8.1** Escalation pathway is a recursive workflow call with `escalation: "regulator"` set.
**F8.2** The escalation letter cites all prior correspondence (which is in workflow state).
**F8.3** Regulator-specific submission flows (e.g. CAA's online form) are handled via Bright Data's `scraping_browser_*` tools as a stretch goal; for v1 the agent generates a regulator-ready PDF/letter and emails the user with submission instructions.

### F9. Memory loop (Mubit)

**F9.1** After every workflow step, structured traces are written to Mubit via `remember()`.
**F9.2** Before every important decision, `getContext()` injects relevant past lessons into the LLM's system prompt.
**F9.3** When a campaign closes (won/lost/cancelled), `reflect()` is called to extract durable lessons.
**F9.4** Successful outcomes call `recordOutcome()` to upweight the lessons that drove them.
**F9.5** The dashboard's "Lessons Learned" panel reads from `surfaceStrategies()` — this is the demo's critical visual proof of memory.

### F10. Web dashboard

**F10.1** Single-page dashboard showing all of the user's campaigns.
**F10.2** Layout (3 columns):
  - **Left rail (320px):** campaign list, status pills, last-updated timestamp.
  - **Centre:** selected campaign's detail panel — facts, research, full timeline of every action, every email sent and received.
  - **Right rail (320px):** "Lessons Learned" — what the agent has learned across all campaigns of this category.
**F10.3** A bottom strip shows real-time activity ticker.
**F10.4** A "View Workflow Trace" button opens the Vercel observability dashboard for that workflow run (deep-link).
**F10.5** Mobile-responsive — degrades to single column with tab navigation.

### F11. Observability hand-off

**F11.1** All workflows must be visible in the Vercel `/workflows` dashboard with named steps.
**F11.2** Step names use human-readable verbs (`research-target`, `draft-letter`, `send-email`, `wait-for-reply-or-deadline`).
**F11.3** Stream chunks emitted from steps include user-facing progress messages (Vercel's resumable streams primitive).

### F12. Demo mode (the pitch's centerpiece — see `09_DEMO_MODE.md`)

**F12.1** The application supports a "demo mode" where workflow sleeps are scaled by a configurable factor (`demoScale`), passed as workflow input.
**F12.2** A `demoSleep(duration, scale)` helper wraps `sleep()` and divides real-time durations by the scale factor (with a 2-second floor for legibility).
**F12.3** A `simulateReplies` workflow runs alongside the main `pursueGrievance` workflow in demo mode, posting scripted "company replies" to the existing inbound webhook on a scaled schedule.
**F12.4** Three preset scenarios must exist and be triggerable via dev-panel buttons: **Easy Win** (~25s), **Negotiation** (~50s), **Escalation** (~80s).
**F12.5** The dashboard renders a `▶▶ FAST FORWARD ×N` indicator on campaigns running in demo mode.
**F12.6** Lessons added by `reflect()` at end of demo campaigns animate into the right rail with a 60ms-per-card stagger — the demo's payoff moment.
**F12.7** The orchestrator endpoint `/api/demo/run` is gated by env (`ENABLE_DEMO_MODE=1`) and accepts only the three scripted scenarios.
**F12.8** Demo workflow runs are visible in the Vercel observability dashboard alongside real ones — judges can inspect the trace and see real WDK runs.

### F13. Multi-vertical visibility

**F13.1** The dashboard must display campaigns from **at least 3 categories** at demo time.
**F13.2** Categories beyond the actively-implemented vertical (`UK_FLIGHT_DELAY`) are seeded as **static records** with hand-written timelines — they don't trigger workflows but they appear in the campaign list.
**F13.3** Each seeded fake includes ≥ 2 lessons in the right rail tagged with its category, supporting the platform claim that "every category teaches every other."
**F13.4** Seeded categories for the demo: `PARKING_FINE`, `SUBSCRIPTION_CANCELLATION`, and `TRAIN_DELAY` (Delay Repay scheme).

## 6. Non-functional requirements

| ID | Requirement | Why |
|----|-------------|-----|
| N1 | A workflow run must survive a Vercel redeploy mid-execution. | Core durability promise. |
| N2 | A workflow run must resume correctly after a 14-day sleep. | EU261 response window. |
| N3 | LLM tool selection latency < 4s for any step. | Demo feel. |
| N4 | Telegram round-trip (user message → agent reply) < 6s for typed input, < 12s for voice. | Demo feel. |
| N5 | Dashboard initial paint < 1.5s on mobile 4G. | Judges look at it on phones. |
| N6 | All secrets in environment variables, never committed. | Obvious. |
| N7 | Encryption-at-rest for workflow state via WDK's built-in encryption. | Real complaint emails are PII. |

## 7. Out of scope (v1 / hackathon)

- Multi-user authentication (assume single-user mode for the demo, identified by Telegram chat ID).
- **Live execution** of grievance verticals beyond `UK_FLIGHT_DELAY`. (Visible-but-static seeded campaigns from other categories are IN scope per F13 — they support the platform story without requiring per-vertical legal knowledge to be implemented.)
- Automated regulator form submission (we draft the regulator letter; user submits).
- Payment / settlement processing.
- Mobile app.
- Anything that takes > 1.5 hours to build during the day.

## 8. Success metrics

### Hackathon-day metrics

| Metric | Target |
|--------|--------|
| Local prize pool placement | 1st (£2.5k cash + credits) |
| Mubit track placement | Winner ($100k Mubit credits) |
| Bright Data overall winner kicker | Win ($1k credits) |
| Global Vercel community vote (May 4) | Top 3 |
| Live demo failures during 3-min pitch | 0 |
| Real campaigns running on stage | ≥ 3 |
| Mubit lessons surfaced on dashboard | ≥ 5 |

### Product-level metrics (post-hackathon, for the pitch narrative)

- Average successful claim value: target £200+
- Time from intake to user receiving funds: target < 30 days median
- Win rate on EU261 cases: target 60%+ (industry baseline ~40%)
- Lessons accumulated per category after 50 campaigns: ≥ 30

## 9. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bright Data MCP returns no useful data for an unfamiliar airline | Med | High | Pre-cache the top-5 UK airlines' complaints emails as Mubit `fact` entries before the demo. |
| Telegram bot setup takes longer than expected on the day | Low | Med | Bot setup the night before. BotFather flow is 60 seconds. |
| Mubit API instability | Med | High | Wrap every Mubit call in try/catch; agent should degrade gracefully (still functions, just doesn't learn). |
| Resend domain verification not propagated in time | Med | Med | Use `onboarding@resend.dev` as a fallback for the demo. |
| WDK behaves differently in production vs local | Low | High | Deploy early on Saturday, test the Vercel deployment, not just local. |
| Demo machine WiFi flakes | Med | Catastrophic | Pre-record a 30-second backup video of the Telegram flow as fallback. |
| Judges interpret "real grievances" as legally risky | Low | Med | Demo data uses real airlines but synthetic flights / your own actual past delays only. |
| A demo scenario gets stuck mid-pitch (workflow error, dashboard freeze) | Med | Catastrophic | Three scenarios = three independent escape hatches. Rehearse all three to muscle memory. If one breaks live, move on to the next without acknowledging. |
| Judges suspect the demo is fake / pre-recorded | Med | High | Open the Vercel `/workflows` tab during the pitch and click into the live trace — proves the runs are real. The same workflow code path runs both real and demo campaigns. |
| Compressed time confuses judges who think you're skipping steps | Low | Med | The `▶▶ FAST FORWARD ×100` indicator is mandatory — it tells the audience explicitly "we're compressing 14 days into 10 seconds." |

## 10. Pre-event preparation (do before Saturday morning)

These are tasks for tonight (Friday May 1):

1. ✅ This PRD and supporting docs created.
2. ⏳ Private GitHub repo created.
3. ⏳ Telegram bot created via @BotFather, token saved.
4. ⏳ Resend account created, domain (or fallback) verified.
5. ⏳ ngrok / Vercel preview URL ready for local Telegram testing.
6. ⏳ Personal real-world grievances catalogued for use as demo seed data (3–5 of them).
7. ⏳ Anthropic / Vercel / Mubit / Bright Data accounts created (credit links land Saturday AM but accounts can exist now).
8. ⏳ Initial deployment to Vercel of the empty Next.js shell so DNS / domain works.
9. ⏳ This handoff pack committed to the repo at `docs/`.

## 11. Open questions to resolve Saturday

- Final domain name: `vendetta.app`? `getvendetta.com`? Vercel subdomain is fine for hackathon.
- Telegram bot username — `@VendettaAgentBot` likely taken; pick alternates.
- Are we registering Vendetta as a Poke recipe (stretch goal)? Decision by 17:00 Saturday based on whether core is shipping.

---

**End of PRD.** See `01_BUILD_PLAN.md` for the hour-by-hour execution plan.
