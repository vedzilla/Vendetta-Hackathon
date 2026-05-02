# v0 Dashboard Prompt

Paste this into v0.app to scaffold the dashboard. Iterate from there. Don't use v0's default outputs — push it toward the aesthetic below.

## The aesthetic, in one paragraph

Vendetta's vibe is **legal-but-edgy**: a notary's office crossed with a Bloomberg terminal, with a faint hint of Saul Goodman swagger. NOT the generic SaaS purple-gradient AI app. NOT a slick fintech dashboard. Think **deep oxblood and bone, serif headers, tabular mono for data, sparse but deliberate red accents**, and a grain texture overlay if it doesn't slow render. Restraint. Refinement. The kind of thing that makes a judge ask "where's this from?"

## The v0 prompt (copy-paste this)

```
Build a single-page dashboard for "Vendetta" — an autonomous consumer-rights agent that pursues grievances against companies for weeks at a time. The user is a UK consumer; their open grievances appear here.

LAYOUT (desktop):
- Three-column grid:
  - LEFT (320px wide): "Active Campaigns" list. Each item: company name (in serif), category badge (small, uppercase — must visually distinguish UK_FLIGHT_DELAY, PARKING_FINE, SUBSCRIPTION_CANCELLATION, TRAIN_DELAY using border color only, never solid fill), status pill (color-coded), last-updated timestamp (mono, faded). Selected campaign has a subtle red left-border accent. Campaigns in demo mode show a small `▶▶ FF ×N` chip in the top-right corner of the card.
  - CENTER (flex-1): "Campaign Detail". Top: company name + claim amount big and proud. Below: tab navigation [Timeline / Letters / Research / Trace]. Default tab is Timeline — a vertical list of events (sent letter, received reply, escalated) with timestamps and structured summaries. NEW timeline events animate in with a 150ms slide+fade — never appended silently. When a campaign is in demo mode, a `▶▶ FAST FORWARD ×12000` indicator sits in the header next to the company name in oxblood mono with a faintly pulsing 1px border.
  - RIGHT (320px wide): "Lessons Learned" rail. A scrollable feed of lessons the agent has accumulated across all campaigns. Each lesson is a card with: a quote-style mark, the lesson text in serif italic, a small footer showing source category (e.g. "EU261 / Wizz Air") and outcome icon (✓ success, ✗ failure). NEW lesson cards fade in from opacity 0 with a 60ms-per-card stagger when added — this is the demo's payoff moment, treat it visually as a flourish.
- Bottom strip (full width, 60px): "Live Activity" ticker — horizontally scrolling latest events across all campaigns with timestamps. Tasteful, not chaotic.
- Floating dev panel (bottom-right, fixed position, only visible when `?dev=1` is in URL or in non-production env): a card titled "DEMO CONTROL" with three buttons stacked: `⚡ Easy Win [25s]`, `⚖ Negotiation [50s]`, `🔥 Escalation [80s]`. Each POSTs to `/api/demo/run` with the corresponding scenario name. Below the buttons, a small line shows "Last run: {scenario} ✓ {duration}". Buttons are visually disabled (lower opacity, no pointer cursor) while a demo is in flight to prevent accidental double-fires on stage.

LAYOUT (mobile, < 768px):
- Single column. Top: tab nav [Campaigns / Detail / Lessons]. Bottom strip stays.

DESIGN TOKENS:
- Background: #0F0E0C (warm near-black, not pure black)
- Surface: #1A1815
- Border: #2D2A24
- Text primary: #F2EBDC (warm cream)
- Text muted: #8C8579
- Accent (the only color that pops): #C03022 (oxblood, used sparingly — borders on selection, status="WON" pill, escalation alerts)
- Accent secondary: #B8954E (aged brass, for badges and quote marks)

TYPOGRAPHY:
- Display: "Fraunces", serif, weight 500. Use for company names, campaign titles, lesson text.
- Body: "Geist", sans-serif, weight 400. Default for everything else.
- Mono: "JetBrains Mono", weight 400. Use for timestamps, IDs, claim amounts (£220.00).

DETAILS THAT MATTER:
- A subtle film-grain SVG noise overlay across the full background. Opacity ~3%.
- Status pills use thin 1px borders, not solid backgrounds. Color them with the accent palette only.
- The "Lessons Learned" cards have a tiny ornamental left-border with a brass-colored ❝ pull-quote mark.
- The "View Workflow Trace →" button on each campaign opens an external link to Vercel observability — style it as a subtle text link, not a CTA button.
- Hover states on campaign list items: a 200ms fade-in of a 1px right-border in oxblood.
- All transitions are 200ms ease-out. No bouncy springs.
- Empty state for the right rail: a centered serif italic line saying "No lessons yet — first campaign in flight." with a small wax-seal SVG below.

WHAT TO AVOID:
- Purple-pink gradients.
- Default Tailwind blue.
- Inter or Roboto fonts.
- Card shadows. Use 1px borders only.
- Emoji in the UI chrome (timeline event icons are fine; UI chrome is not).
- The word "AI" or "Agent" anywhere visible. Vendetta is the brand; don't dilute it.

DATA SHAPES:
- Campaign: { id: string, company: string, category: string, status: "INTAKE" | "RESEARCHING" | "DRAFTING" | "AWAITING_APPROVAL" | "SENT" | "AWAITING_REPLY" | "ESCALATED" | "WON" | "LOST", claimAmount: number, currency: string, updatedAt: string, timeline: TimelineEvent[], workflowRunId: string }
- TimelineEvent: { at: string, kind: string, summary: string }
- Lesson: { id: string, content: string, category: string, sourceCompany: string, outcome: "success" | "failure" }

INTERACTIONS:
- Clicking a campaign in the left rail loads it into center.
- Tabs in center are local state, not URL.
- "Approve" / "Edit" / "Cancel" buttons appear in the Letters tab when a draft is awaiting approval.
- Polling: refetch the selected campaign every 3 seconds (assume a /api/grievances/[id] endpoint). Use SWR or basic useEffect.

Use Tailwind. No external UI library. Custom components only. Mobile-first responsive. TypeScript.
```

## After v0 generates

Take the output and:
1. Wire the API endpoints (`/api/grievances`, `/api/grievances/[id]`, `/api/grievances/[id]/approve`).
2. Replace the polling with SSE/streams from the workflow's `getWritable()` — much smoother than polling.
3. Add the favicon + OG image (Vendetta wax seal SVG; Codex can generate this in 30 seconds).
4. Add a tiny dev panel at the bottom-right that's only visible when `?dev=1` is in the URL: simulate-reply buttons (ACCEPTANCE / PARTIAL_OFFER / REJECTION) for each campaign. THIS IS YOUR DEMO LIFELINE.

## Specific component checklist

Confirm v0 produced or you wrote:

- [ ] `<CampaignList />` — left rail
- [ ] `<CampaignDetail />` — center, with tabs
- [ ] `<TimelineView />` — Timeline tab content with slide-fade animation on new events
- [ ] `<LettersView />` — Letters tab with draft + approval buttons
- [ ] `<ResearchView />` — Research tab showing what Bright Data found
- [ ] `<TraceView />` — Trace tab embedding (or deep-linking to) Vercel observability
- [ ] `<LessonsRail />` — right rail with stagger-fade-in for new lessons
- [ ] `<ActivityTicker />` — bottom strip
- [ ] `<StatusPill />` — with all 11 status variants
- [ ] `<CategoryBadge />` — distinguishing 4+ categories by border color only
- [ ] `<FastForwardIndicator />` — the `▶▶ FF ×N` chip on demo-mode campaigns
- [ ] `<DevPanel />` — the three scenario buttons; this is your demo lifeline (see `09_DEMO_MODE.md`)

## Don't skip the empty states

The dashboard will look broken if you launch it before seeding campaigns. Make sure each component has an explicit empty state with a tasteful serif italic line.

## A note on font loading

Use `next/font` to self-host:

```ts
// src/app/layout.tsx
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const geist = Geist({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
```

Then in `globals.css`:

```css
:root {
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);
}
body { font-family: var(--font-body); background: #0F0E0C; color: #F2EBDC; }
.serif { font-family: var(--font-display); }
.mono { font-family: var(--font-mono); }
```
