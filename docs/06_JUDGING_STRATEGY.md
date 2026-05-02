# Judging Strategy

The local prize pool uses a panel of ~8 judges (Oscar, Bright Data rep, Mubit rep, Vercel-adjacent London tech folks). The global pool is a community vote on May 4. Different audiences = slightly different optimization.

## The official rubric

Per the brief, projects are judged on:
1. **Agent usefulness / real-world applicability**
2. **Technical execution (built with v0, deployed on Vercel)**
3. **Creativity and originality**

## Vendetta → rubric mapping

| Criterion | How Vendetta scores | Demo evidence |
|-----------|---------------------|----------------|
| Real-world applicability | Solves a problem every UK consumer has had. £200+ per successful claim. Universal TAM. | "Show of hands" hook in the pitch. The seed campaigns are real. |
| Technical execution | Uses Vercel WDK (durability), AI Gateway (LLM routing), ChatSDK (multi-platform), v0 (UI). Stack is fully Vercel-native. | The workflow trace screen. The Telegram card. The dashboard's right rail. |
| Creativity & originality | No one has built autonomous multi-week grievance pursuit. Closest competitors are single-shot complaint generators. The "agent that gets smarter" angle is genuinely novel for consumer-rights tools. | The Lessons Learned rail in the dashboard. The "campaign #1 vs #10" comparison if you have time. |

## Per-sponsor strategy

### Mubit ($100k credits — separate prize pool)

Mubit's pitch is "agents that learn from execution." Vendetta is the textbook application.

**What Mubit's judges will look for:**
- Does the agent actually learn? (yes — `reflect()` after every campaign, `getContext()` before every decision)
- Is learning visible in the UI? (yes — the right rail)
- Is the code clean? (yes — five lines per Mubit primitive)
- Is the value prop demonstrable? (yes — the "campaign #1 vs #10" comparison)

**What to mention by name in the pitch:**
- "Lessons stored in **Mubit**, retrieved before each new draft."
- "Memory loop: `remember`, `getContext`, `reflect`, `recordOutcome`."
- "The tenth letter is measurably better than the first."

**What to mention in the README to win Mubit:**
> "Vendetta uses Mubit's memory loop end-to-end: every campaign trace is `remember`-ed, every decision is preceded by `getContext`, every closed campaign triggers `reflect`, and successful outcomes call `recordOutcome` to upweight winning strategies. The dashboard's 'Lessons Learned' rail is a live readout of `surfaceStrategies`. This is the **exact pattern** Mubit's docs recommend in the support-agent recipe — applied to consumer-rights pursuit at scale."

### Bright Data ($1k overall winner kicker)

Bright Data wants creative use of their tools across multiple groups.

**Demo at least 3 tools across 3 groups:**
- `search_engine` (free tier) — discovering complaints pages
- `scrape_as_markdown` (free tier) — reading airline policies
- `web_data_linkedin_person_profile` (Pro / social group) — finding execs to escalate to

**Optional 4th for the wow:**
- `extract` (Pro / advanced_scraping) — pulling structured deadlines off regulator pages

**What to mention in the README:**
> "Bright Data's MCP gave the agent eyes on the web with one config line — no custom scrapers, no proxy management, no CAPTCHA fighting. We use `search_engine` for discovery, `scrape_as_markdown` for policy pages, and `web_data_linkedin_person_profile` to find the right exec to escalate to. The agent picks tools autonomously via the AI SDK's tool interface — we never hand-coded a scraper."

### Vercel (Track 1 + global pool)

Vercel wants to see WDK stretched. Don't underuse it.

**Each of these features is a feature flag for "actually using the SDK":**
- ✅ `"use workflow"` directive (the function signature)
- ✅ `"use step"` directive (every external call)
- ✅ `sleep("14 days")` (long pauses without compute)
- ✅ `hookFor()` + `.wait()` (waiting for external events)
- ✅ `getWritable()` (resumable streams to the dashboard)
- ✅ `DurableAgent` (durable AI agent loop)
- ✅ Recursion (escalation re-enters the same workflow)
- ✅ Observability dashboard usage in demo (deep-link from your dashboard)

**What to mention in the README:**
> "Vendetta is one TypeScript file with `'use workflow'` at the top. WDK gives us 14-day sleeps, hook-based waits, retryable steps, and the observability dashboard for free — no queues, no schedulers, no state tables. The same code runs locally and on Vercel. ChatSDK on top means the same agent ships to Telegram, Slack, Discord, and Linear from a single codebase."

## Local pool vs global pool optimization

| Factor | Local pool | Global pool |
|--------|------------|-------------|
| Audience | 8 expert judges, in-person, time-pressured | Community vote, async, 2 days |
| Optimization | The 3-minute pitch, eye contact, the workflow trace | The README, the demo video, the screenshots |
| Hook | "Show of hands" — works in a room | A killer hero image / 30-second video — works on a feed |
| Closer | "Vendetta might change a million people's [lives]" | A clear before/after of "campaign #1 vs #10" |

For the **global pool**, the README is what wins. Spend 30 minutes on Saturday evening writing a README that has:
1. **A hero animated GIF** showing the Telegram → dashboard → trace flow.
2. **The architecture diagram** (steal from `03_ARCHITECTURE.md`).
3. **A "what's novel here" callout box.**
4. **Live demo links** (deployed app + Telegram bot username).
5. **The pitch one-liner** as the repo description.

## Things that earn bonus marks but most teams will skip

- ✅ **A favicon and OG image.** Costs 5 minutes. Judges screenshot the dashboard for the deck. Unbranded screenshots look hacky.
- ✅ **A `<title>` tag that's not "Next.js App."**
- ✅ **Mobile-responsive dashboard.** Judges will open it on their phones during your pitch.
- ✅ **A "View on Vercel Workflow" button on each campaign that deep-links to observability.** Judges from Vercel will click this.
- ✅ **A loading skeleton** for slow steps. Don't show a white screen.
- ✅ **A clear "How it works" section in the README** with the 4-component diagram.

## Things that earn ZERO marks

- ❌ Generic AI gradient backgrounds.
- ❌ "Built with [logo soup]" sections in the README.
- ❌ Fake testimonials.
- ❌ A pitch deck (no slides; use the dashboard).
- ❌ Long-winded "the future of consumer rights is here" intros. Get to the demo in <20 seconds.
- ❌ Apologising for what's missing. If it's missing, it's intentional.

## The judges-room reality

Hackathon judging is more political than people admit. Judges retain ~3 projects after watching 30. To be in the top 3, you need:

1. **A name they remember.** "Vendetta" sticks. (Compare to "AgentDive" or "RuaLead AI" from the current showcase.)
2. **A line they can repeat to other judges.** "Show of hands" + "It pursues for weeks" + "Tenth letter better than first."
3. **A visual moment they screenshotted.** Make sure the dashboard screenshot is shareable on its own.

Your job is to make Vendetta the easy choice for any judge fighting for it in the deliberation.
