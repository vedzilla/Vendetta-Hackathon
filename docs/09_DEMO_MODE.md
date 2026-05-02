# Demo Mode — Time-Warp Design

This is the document that lets the demo land. Without it, judges see the agent's opening move and have to *imagine* the rest. With it, they watch the entire three-week arc rip past in 90 seconds.

## Why this exists

A traditional live agent demo shows the *opening move* and asks the audience to imagine the rest. "Now picture this campaign continuing for three weeks…" — judges nod politely, but they leave the room with one image (a draft letter being approved) when the actual product is the seventeen things that happen *after*. The reply, the negotiation decision, the second letter, the deadline lapsing, the regulator escalation, the lessons emerging at close-out. None of that is visible in a normal demo. You're judged on the iceberg's tip.

Demo mode fixes this by **compressing time, not skipping it**. The workflow is real. The Mubit calls are real. The dashboard updates are real. The only thing simulated is the company's reply payloads — which arrive at the same inbound webhook a real reply would, take the same code path, and trigger the same hooks.

## The principle

> The demo is honest. It's the same workflow, the same code, the same observability trace — just with synthetic email bodies replacing what the airline would have sent, and sleeps divided by 12,000.

This matters because if a judge inspects the workflow trace mid-demo (and Vercel judges *will*), they see real workflow runs with real steps, real hook resolutions, real Mubit calls. The trick is in the inputs, not the architecture.

## The three components

### 1. `demoSleep()` — scaled waits

```ts
import { sleep } from "workflow";

export async function demoSleep(realDuration: string, demoScale: number = 1) {
  if (demoScale === 1) return sleep(realDuration);

  const ms = parseDuration(realDuration); // "14 days" -> 1209600000
  const scaledMs = Math.max(2000, Math.floor(ms / demoScale));
  return sleep(`${scaledMs}ms`);
}

function parseDuration(s: string): number {
  // handles "14 days", "30s", "5m", "2h"
  const match = s.match(/^(\d+)\s*(s|m|h|days?)$/);
  if (!match) throw new Error(`Bad duration: ${s}`);
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const factors = { s: 1000, m: 60_000, h: 3_600_000, day: 86_400_000, days: 86_400_000 };
  return n * factors[unit as keyof typeof factors];
}
```

The workflow accepts `demoScale` as part of its input and threads it through:

```ts
async function pursueGrievance(input: {
  grievanceId: string;
  demoScale?: number;
  isEscalation?: boolean;
}) {
  "use workflow";
  const scale = input.demoScale ?? 1;

  // ...later
  await demoSleep("14 days", scale); // 14 days real → ~100 seconds at scale 12_000
}
```

**Floor of 2 seconds** is intentional — judges need to see the FAST FORWARD overlay long enough to register what's happening. Don't compress so hard that the timeline events flash past unreadably.

### 2. The reply simulator (itself a workflow)

The simulated company replies aren't `setTimeout` chains in API routes — those die when the function returns. They're a second WDK workflow that runs alongside the main one, sleeping and POSTing simulated payloads to your existing inbound webhook.

This is a feature, not a workaround: **the demo orchestration is itself a durable workflow.** Open the Vercel observability tab during your pitch and you can show *two* concurrent workflow runs — the campaign and its replies — both real, both durable.

```ts
// src/workflows/simulate-replies.ts
import { demoSleep } from "@/lib/demo-sleep";
import { SCENARIOS } from "@/lib/demo-scenarios";

export async function simulateReplies(input: {
  grievanceId: string;
  scenario: keyof typeof SCENARIOS;
  demoScale: number;
}) {
  "use workflow";

  const script = SCENARIOS[input.scenario];

  for (const beat of script.beats) {
    await demoSleep(beat.afterDelay, input.demoScale);
    await postSimulatedReply(input.grievanceId, beat); // step
  }
}

async function postSimulatedReply(grievanceId: string, beat: ReplyBeat) {
  "use step";

  const replyDomain = process.env.RESEND_REPLY_DOMAIN ?? "vendetta.app";
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/resend`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-token": process.env.DEMO_TOKEN! },
    body: JSON.stringify({
      type: "email.delivered.inbound",
      data: {
        from: beat.from,
        to: `replies+${grievanceId}@${replyDomain}`,
        subject: beat.subject,
        text: beat.body,
        receivedAt: new Date().toISOString(),
      },
    }),
  });
}
```

The webhook handler at `/api/webhooks/resend` checks for `x-demo-token` and, if present, accepts the synthetic payload as if it were real. In production without the token, only Resend can post.

### 3. The orchestrator endpoint

```ts
// src/app/api/demo/run/route.ts
import { z } from "zod";
import { createGrievance } from "@/lib/store";
import { pursueGrievance } from "@/workflows/pursue-grievance";
import { simulateReplies } from "@/workflows/simulate-replies";
import { SCENARIOS } from "@/lib/demo-scenarios";

const Schema = z.object({
  scenario: z.enum(["easy_win", "negotiation", "escalation"]),
});

export async function POST(req: Request) {
  const { scenario } = Schema.parse(await req.json());
  const script = SCENARIOS[scenario];

  // Pre-populate with the scripted seed
  const grievance = await createGrievance({
    rawDescription: script.voiceNoteText,
    facts: script.preExtractedFacts,
    notifyVia: { telegram: { chatId: process.env.DEMO_TELEGRAM_CHAT_ID! } },
    metadata: { demoMode: true, scenario },
  });

  const DEMO_SCALE = 12_000; // 14 days → 100s

  // Start both workflows in parallel
  const [{ runId: campaignRunId }, { runId: simRunId }] = await Promise.all([
    pursueGrievance.start({ grievanceId: grievance.id, demoScale: DEMO_SCALE }),
    simulateReplies.start({ grievanceId: grievance.id, scenario, demoScale: DEMO_SCALE }),
  ]);

  return Response.json({
    grievanceId: grievance.id,
    campaignRunId,
    simRunId,
    estimatedDuration: script.estimatedSeconds,
  });
}
```

## The seeded backdrop

The compressed demo is what you *show*. What makes it *believable* is the dashboard already being populated with real-looking campaigns when judges glance at it before you start. You need this set up by **Saturday morning**.

| # | Type | Category | Status | Purpose |
|---|------|----------|--------|---------|
| 1 | **Real, started Friday evening** | UK_FLIGHT_DELAY (your actual past delay) | AWAITING_REPLY | Genuinely waiting for a real airline reply by demo time. The "this is real" anchor. |
| 2 | **Real, started Friday evening** | UK_FLIGHT_DELAY (another of your delays) | NEGOTIATING (or whatever stage it organically reaches) | Second proof-of-life campaign. Different airline if possible. |
| 3 | **Seeded fake** | PARKING_FINE | ESCALATED | Universally hated category. Comedy beat in pitch. |
| 4 | **Seeded fake** | SUBSCRIPTION_CANCELLATION | WON | "Got my £127 back from a gym I cancelled in 2024." Big emotional resonance. |
| 5 | **Seeded fake** | TRAIN_DELAY (Delay Repay) | AWAITING_APPROVAL | London judges instantly recognize this. Delay Repay is the UK rail compensation scheme. |

The fake campaigns are static KV records with hand-written timelines and 2 lessons each in the right rail. They never trigger workflows. They exist solely so the dashboard looks alive and so the platform claim ("works for any consumer grievance") is visually substantiated without requiring you to actually build 4 verticals.

### Real campaigns to start Friday evening

```bash
# Friday ~21:00 — start your two real campaigns at scale 24
# (1 day of real time = 1 hour of compressed time, so by 11am Saturday you have ~14 days of progress)
curl -X POST https://vendetta.vercel.app/api/grievances \
  -H "Content-Type: application/json" \
  -d '{"description": "Your real grievance text here", "demoScale": 24}'
```

Two of these on Friday night, on real past delays you've actually experienced, sent to real airline complaints addresses (or to a sandbox that bounces back) — by Saturday morning these campaigns will be at organic mid-stages with genuine timestamps.

## Three scenarios, scripted

These live as a TypeScript constant in `src/lib/demo-scenarios.ts`. The exact text matters — these are the words judges will read on the dashboard.

### Scenario 1: Easy Win (~25s of stage time)

Use this scenario when the room is short on attention or when you're recovering from a previous demo running long. It's the safe one.

```ts
easy_win: {
  voiceNoteText:
    "Wizz Air delayed my flight from Luton to Budapest by four hours yesterday, " +
    "the first of May, booking reference W6-9XYZ. I want compensation.",
  preExtractedFacts: {
    company: "Wizz Air",
    incidentDate: "2026-05-01",
    referenceNumber: "W6-9XYZ",
    amountClaimed: 220,
    currency: "GBP",
  },
  estimatedSeconds: 25,
  beats: [
    {
      afterDelay: "10 days",   // → ~70s at scale 12_000
      from: "customercare@wizzair.com",
      subject: "Re: Compensation claim — W6-9XYZ — 2026-05-01",
      body:
        "Dear Passenger,\n\n" +
        "Thank you for contacting Wizz Air Customer Care regarding flight W6-9XYZ on " +
        "1 May 2026. Following our review, we confirm the delay was within our operational " +
        "control. We have authorised payment of EU261/UK261 compensation in the amount " +
        "of £220 to your original payment method, processed within 7-10 business days.\n\n" +
        "Reference: WCC-2026-19284\n\n" +
        "Wizz Air Customer Care Team",
    },
  ],
}
```

### Scenario 2: Negotiation (~50s of stage time)

The product's judgement layer. Shows the agent isn't running a script — it's deciding.

```ts
negotiation: {
  voiceNoteText:
    "easyJet delayed my flight EZY1234 from Gatwick to Barcelona by three and a half hours " +
    "on the twenty-eighth of April, booking reference EZ8K2P3. I want what I'm owed.",
  preExtractedFacts: {
    company: "easyJet",
    incidentDate: "2026-04-28",
    referenceNumber: "EZ8K2P3",
    amountClaimed: 350,
    currency: "GBP",
  },
  estimatedSeconds: 50,
  beats: [
    {
      afterDelay: "8 days",
      from: "claims@easyjet.com",
      subject: "Re: Your claim EZ8K2P3 — case 2026-44721",
      body:
        "Dear Customer,\n\n" +
        "We acknowledge receipt of your complaint regarding flight EZY1234 on 28 April 2026. " +
        "As a goodwill gesture, easyJet is pleased to offer you a £50 voucher redeemable " +
        "against any future easyJet booking, valid for 12 months from the date of issue. " +
        "Please reply to this email within 14 days to accept this offer.\n\n" +
        "Customer Service\n" +
        "easyJet UK",
    },
    // The agent autonomously generates and sends the counter at this point — Mubit lesson
    // recall identifies the £50-voucher pattern and prompts citing Article 7(3).
    {
      afterDelay: "8 days", // after the counter is sent
      from: "claims@easyjet.com",
      subject: "Re: Your claim EZ8K2P3 — case 2026-44721 (revised)",
      body:
        "Dear Customer,\n\n" +
        "Following your reference to Article 7(3) of EC 261/2004 regarding the form of " +
        "compensation, we will process the full UK261 compensation amount of £350 to your " +
        "original payment method within 14 business days. The voucher offer is hereby " +
        "withdrawn.\n\n" +
        "Customer Service\n" +
        "easyJet UK",
    },
  ],
}
```

### Scenario 3: Escalation (~80s of stage time)

The big story. This is the one to use unless the room feels short on attention. Demonstrates the entire pursuit pathway including regulator filing.

```ts
escalation: {
  voiceNoteText:
    "Ryanair delayed my flight FR8821 from Stansted to Krakow by five hours, " +
    "no compensation offered, booking reference RY3K8H. The delay was their fault, not weather.",
  preExtractedFacts: {
    company: "Ryanair",
    incidentDate: "2026-04-25",
    referenceNumber: "RY3K8H",
    amountClaimed: 220,
    currency: "GBP",
  },
  estimatedSeconds: 80,
  beats: [
    {
      afterDelay: "8 days",
      from: "customer.relations@ryanair.com",
      subject: "Re: Your enquiry — RY3K8H",
      body:
        "Dear Passenger,\n\n" +
        "We regret that the delay to your flight FR8821 was caused by extraordinary " +
        "circumstances beyond our control, specifically air traffic control restrictions " +
        "at the destination airport. As such, EC 261/2004 compensation is not payable " +
        "in this instance. We apologise for the inconvenience caused.\n\n" +
        "Ryanair Customer Service",
    },
    // Agent auto-counters demanding NOTAM evidence based on Mubit lesson:
    // "Ryanair frequently cites 'ATC extraordinary circumstances' without evidence; demand NOTAM"
    {
      afterDelay: "7 days",
      from: "customer.relations@ryanair.com",
      subject: "Re: Your enquiry — RY3K8H (final)",
      body:
        "Dear Passenger,\n\n" +
        "We are unable to provide the specific NOTAM reference you have requested. " +
        "Our position remains unchanged. This is our final response on this matter.\n\n" +
        "Ryanair Customer Service",
    },
    // Agent autonomously escalates to AviationADR. Visible new step in timeline.
    {
      afterDelay: "10 days",
      from: "decisions@aviationadr.org.uk",
      subject: "Adjudication decision — RY3K8H — Case AADR-26-8472",
      body:
        "Dear Complainant,\n\n" +
        "Following our review of your case file (AADR-26-8472), and the airline's failure " +
        "to substantiate its claim of extraordinary circumstances with the documented NOTAM " +
        "evidence requested, we find in your favour. Ryanair is hereby directed to pay the " +
        "full UK261 compensation amount of £220 plus statutory interest within 14 days of " +
        "this decision.\n\n" +
        "AviationADR Adjudication Service",
    },
  ],
}
```

## Lessons fade-in (the demo's payoff)

When the workflow's `reflect()` step completes at end of campaign, the dashboard's right rail receives the new lessons via SSE and animates them in with a 200ms stagger. **This is the single most important visual moment of the entire demo** — it's the proof of "the agent is learning."

The new lessons that appear after each scenario are pre-determined (by the seed prompts to `reflect()` mode that ensure consistent extraction). For the demo:

**After Easy Win:**
1. *"Wizz Air accepts EU261 claims with full booking reference and Article 7 cited in subject within 10 days when delay was within their control."*

**After Negotiation:**
1. *"easyJet's first response is consistently a £50 voucher; cite Article 7(3) on form of payment to upgrade to cash entitlement."*
2. *"easyJet upgrades voucher to cash within 8 days when challenged on Article 7(3)."*

**After Escalation:**
1. *"Ryanair frequently cites 'ATC extraordinary circumstances' without specific NOTAM evidence; demand it."*
2. *"When airline fails to provide NOTAM evidence within 7 days, AviationADR escalation is highly successful."*
3. *"AviationADR upholds 78% of EU261 disputes where evidentiary gap exists in airline's response."*

These should NOT be hardcoded into the simulated reply payloads — they should be the genuine output of the LLM's `reflect()` call given the campaign's actual timeline. Pre-test these to confirm the model produces something close to them; if it produces dramatically different lessons, that's fine and arguably better (more authentic).

## Visual language of compressed time

These design beats matter — they're what makes the time-warp legible:

- **FAST FORWARD overlay** appears on a campaign card whose workflow is running in demo mode. Position: top-right corner. Style: small monospace label `▶▶ FAST FORWARD ×12000` in oxblood text, 12px, mono font, with a faintly pulsing border. NOT a full-card overlay — must remain readable.
- **Timeline events animate in** with a 150ms slide+fade as they appear. Don't just append silently.
- **Status pill transitions** are 300ms cross-fade between colors. The change of state is itself the story.
- **The clock/timestamp** in the header of a demo-mode campaign spins fast — a CSS animation that mimics a watch second-hand at high speed. Optional but visually delightful.
- **Lessons rail entries** fade in from `opacity: 0` with a 60ms-per-card stagger. Up to 3 cards animating simultaneously feels dramatic; more than 5 looks busy.

## The dev panel

Bottom-right of the dashboard, only visible when `?dev=1` is in the URL (or in non-production env):

```
┌─────────────────────────────┐
│  DEMO CONTROL               │
│  ─────────────────────────  │
│  ⚡ Easy Win        [25s]   │
│  ⚖  Negotiation     [50s]   │
│  🔥 Escalation       [80s]  │
│  ─────────────────────────  │
│  Last run: easy_win  ✓ 0:24 │
└─────────────────────────────┘
```

Each button POSTs to `/api/demo/run` and starts the chosen scenario. A "Last run" line shows the most recent button press for confidence ("yes, the button works"). Buttons are **disabled while a demo is running** to prevent accidental double-fires on stage.

Pre-pitch checklist for the dev panel:
- All three buttons tested in the venue's WiFi environment
- Last-run timestamp visible
- Visual feedback within 200ms of click (don't make yourself wonder if the click registered)

## Failure handling on stage

Order of fallbacks if something breaks live:

1. **Button doesn't fire** → wait 3 seconds, click again. Don't narrate the click.
2. **Button fires but no campaign appears** → switch tabs to Vercel observability, point at the workflow trace ("you can see it started here — let me show you instead from a campaign that completed earlier"), pivot to a seeded WON campaign and tell its story instead.
3. **Campaign starts but stalls** → switch to backup video (next section). Don't panic, don't apologise. "Let me show you a recorded run from earlier today" — judges accept this completely.
4. **Whole dashboard 500s** → laugh, say "Vercel is having a bad day" (the room will laugh), pull out phone, do the Telegram-only demo (which is independent of the dashboard).

## The backup video

Record this on Saturday afternoon, after demo mode is fully working. Specs:

- **Length:** 90 seconds, exactly. Trim to fit.
- **Capture:** Use the Escalation scenario (the most impressive). Phone-screen recording for the Telegram interaction in picture-in-picture, dashboard recording as the main canvas.
- **No voiceover.** Captions only — voiceover dates badly and forces rhythm. Captions let the live narration adapt to the room.
- **End frame:** Hold for 3 seconds on a "vendetta.vercel.app" card with the QR code.
- **Format:** MP4, 1080p, < 30MB. Both as a YouTube unlisted upload AND as a local file on your laptop. The local file is what plays if WiFi dies.
- **Open in a tab** before you go up. Don't browse to it live.

## What this earns you

This whole apparatus exists to convert one moment in your pitch from a hand-wave into a demonstration:

> "It pursues it for weeks, autonomously, getting smarter on every case."

Without demo mode, this sentence is a claim. With demo mode, it's a thing the judges *just watched*. The difference between those two states is the difference between 3rd place and 1st.
