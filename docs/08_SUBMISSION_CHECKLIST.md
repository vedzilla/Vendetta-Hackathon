# Submission Checklist

You must submit to **both pools separately** — the Notion form and the Vercel community page are not linked.

## Hard deadlines

- **Local pool:** 19:30 BST Saturday May 2 (event same day)
- **Global Vercel pool:** Voting opens May 4 — submit by end of Saturday to be in the running

## What you need ready before submitting

| Asset | Where it lives | Notes |
|-------|----------------|-------|
| Public GitHub repo | `github.com/<you>/vendetta` | Public, README on top, license file |
| Live deployment | `vendetta.vercel.app` (or domain) | Must be reachable |
| Demo video (60–90s) | YouTube unlisted or Loom | Linked in README |
| Architecture diagram | PNG/SVG in `docs/` and embedded in README | Use the one in `03_ARCHITECTURE.md` |
| Hero image | `og.png` in `public/` | 1200×630, used for social previews |
| README pitch | Top of repo | One-paragraph hook + features list + tech stack |

## Local pool submission

URL: https://oscarama.notion.site/352f4900574780f1a8c8f330080c4af8

Fields they'll likely ask for (based on the brief):
- Project name: **Vendetta**
- One-line tagline: **Your unpaid junior solicitor — autonomous grievance pursuit, durable for weeks.**
- Track choice: **Vercel Workflow (WDK)** — primary. Mention that ChatSDK is layered on top.
- Mubit track entry: **Yes** (memory loop is core to the product, see README section "Memory")
- Public repo URL
- Live URL
- Demo video URL
- Sponsors used: **Vercel WDK, AI Gateway, ChatSDK, Mubit, Bright Data**

## Global Vercel pool submission

URL: https://community.vercel.com/hackathons/zero-to-agent

Same materials. The community vote weighs visual presentation heavily — make sure the README and demo video are polished.

## README structure (ready to copy-tweak)

```markdown
# Vendetta 🩸

> Your unpaid junior solicitor. Autonomous grievance pursuit, durable for weeks.

[Live demo](https://vendetta.vercel.app) · [Demo video](https://...) · [@VendettaAgentBot on Telegram](https://t.me/...)

![Hero](docs/hero.gif)

## What it does

You describe a consumer grievance once — a delayed flight, a parking fine, a refund the company is ghosting. Vendetta pursues it autonomously for weeks. It drafts the first letter, finds the right complaints address, sends, sleeps until the legal response window closes, wakes when the company replies, decides whether to accept or escalate, files with the regulator if needed. Every campaign teaches the next.

## Why it's interesting

- **Durable for weeks, not seconds.** Built on Vercel Workflow SDK. A 21-day campaign survives every redeploy.
- **Gets smarter over time.** Mubit memory layer extracts lessons from each closed campaign. The tenth letter is measurably better than the first.
- **Multi-platform from day one.** Vercel ChatSDK ships the same agent to Telegram, Slack, Discord, and Linear from one codebase.
- **No custom scrapers.** Bright Data MCP gives the agent eyes on every airline, council, and regulator.

## Architecture

![Architecture](docs/architecture.png)

The whole product is one TypeScript workflow file. WDK provides durability, AI Gateway provides the LLM, Mubit provides memory, Bright Data provides web access, ChatSDK provides the surfaces.

## Stack

| Layer | Service |
|-------|---------|
| Framework | Next.js 15 + Vercel |
| Workflow durability | Vercel Workflow SDK |
| LLM routing | Vercel AI Gateway → Claude Opus 4.7 / Sonnet 4.6 |
| Memory layer | Mubit |
| Web data | Bright Data MCP |
| Messaging surface | Vercel ChatSDK + Telegram adapter |
| Outbound email | Resend |
| State | Vercel KV |

## How memory works

After every closed campaign, Vendetta calls `reflect()` on Mubit which extracts durable lessons. Before every important decision (research target, draft tone, escalation timing), it calls `getContext()` to inject relevant past lessons into the LLM's prompt. Successful outcomes call `recordOutcome()` to upweight the lessons that drove them. The dashboard's right rail shows `surfaceStrategies()` live.

[Lessons rail screenshot]

## Try it

1. Open Telegram → search `@VendettaAgentBot` → start a chat.
2. Send a voice note describing a real grievance ("Wizz Air delayed me 4 hours yesterday from Luton to Budapest").
3. Approve the draft when it appears.
4. Watch the campaign progress at [vendetta.vercel.app](https://vendetta.vercel.app).

## Built for

[Vercel Zero to Agent — London, May 2026](https://community.vercel.com/hackathons/zero-to-agent)

Built solo by [@you](https://github.com/you).

Sponsors: [Vercel](https://vercel.com), [Mubit](https://mubit.ai), [Bright Data](https://brightdata.com), [Code Rabbit](https://coderabbit.ai), [Halkin](https://halkin.com), [Swift Food](https://swiftfood.uk).
```

## Demo video script (60s)

If you don't have time for video editing, screen-record yourself doing the live demo and trim to:

```
0:00–0:05 — Black slate: "Vendetta. Your unpaid junior solicitor."
0:05–0:25 — Phone screen: voice note in Telegram → bot reply with approval card → tap approve.
0:25–0:50 — Cut to dashboard, show campaign list, click into one with reply history, point at lessons rail.
0:50–1:00 — Cut to Vercel observability trace, show the 14-day sleep, end on a "vendetta.vercel.app" card.
```

Tools that work for this in <30 minutes: Loom, OBS + iMovie, ScreenStudio (Mac).

## The post-event push (May 3 + 4)

The global pool is decided by community vote on May 4 — so May 3 is your push window:

- Tweet the demo video. Tag `@vercel` and `@oscarfalll`. Use `#ZeroToAgent`.
- Post on LinkedIn with a different angle (the "I built this in a day" angle works well there).
- Cross-post to Hacker News if you can stomach it. Show HN: title.
- Post in the Vercel Discord / community Slack.
- Send the demo to anyone you know in the Vercel ecosystem (founders, DevRel) and ask for a vote / share.

## Self-grade before submitting

Walk through this checklist at 19:00:

- [ ] Live URL works on a fresh incognito window.
- [ ] Telegram bot responds within 5s of a `/start`.
- [ ] At least 3 seeded campaigns visible on dashboard.
- [ ] Lessons rail shows ≥ 5 lessons.
- [ ] Vercel `/workflows` shows real workflow runs.
- [ ] README renders cleanly on GitHub.
- [ ] Demo video plays at the linked URL.
- [ ] OG image renders correctly when you share the URL in iMessage / Slack.
- [ ] Mobile view of dashboard doesn't break.
- [ ] You can do the 3-min pitch in 2:50 reliably.

If any of these are red, fix that before adding any new feature.
