# Architecture

## Folder layout

```
vendetta/
├── CLAUDE.md                          # Read-this-first for Claude Code
├── README.md                          # Public-facing
├── .env.example
├── .env.local                         # gitignored
├── next.config.ts                     # wrapped with withWorkflow()
├── tsconfig.json
├── package.json
├── docs/                              # this whole pack
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # fonts, theme
│   │   ├── page.tsx                   # dashboard (single page)
│   │   ├── globals.css                # design tokens
│   │   │
│   │   └── api/
│   │       ├── grievances/
│   │       │   ├── route.ts           # POST: create grievance, start workflow
│   │       │   └── [id]/
│   │       │       ├── route.ts       # GET: fetch grievance + timeline
│   │       │       └── approve/route.ts  # POST: human-in-loop approval signal
│   │       │
│   │       └── webhooks/
│   │           ├── telegram/route.ts  # Telegram bot webhook
│   │           └── resend/route.ts    # Inbound email reply webhook
│   │
│   ├── components/
│   │   ├── CampaignList.tsx
│   │   ├── CampaignDetail.tsx
│   │   ├── LessonsRail.tsx
│   │   ├── ActivityTicker.tsx
│   │   ├── ApprovalCard.tsx           # used in dashboard for in-browser approvals
│   │   └── ui/                        # primitive components (Button, Pill, etc.)
│   │
│   ├── workflows/
│   │   ├── pursue-grievance.ts        # the main "use workflow" function
│   │   ├── simulate-replies.ts        # demo-mode parallel workflow (posts scripted replies)
│   │   └── steps/
│   │       ├── classify.ts
│   │       ├── extract-facts.ts
│   │       ├── research.ts            # uses Bright Data
│   │       ├── draft-letter.ts        # uses Claude Opus
│   │       ├── send-email.ts          # uses Resend
│   │       ├── wait-for-reply.ts      # WDK hook + sleep
│   │       ├── classify-reply.ts
│   │       ├── escalate.ts
│   │       └── reflect-and-record.ts  # Mubit close-out
│   │
│   ├── lib/
│   │   ├── ai.ts                      # AI Gateway model exports
│   │   ├── mubit.ts                   # Mubit client wrapper
│   │   ├── brightdata.ts              # Bright Data MCP client + tools
│   │   ├── resend.ts                  # Resend send + parse
│   │   ├── store.ts                   # KV-backed grievance store
│   │   ├── chat.ts                    # ChatSDK Telegram bot setup
│   │   ├── prompts.ts                 # System prompts + templates
│   │   ├── demo-sleep.ts              # demoSleep helper for time-warp
│   │   ├── demo-scenarios.ts          # The three scripted scenarios + seeds
│   │   └── seeded-campaigns.ts        # The static multi-vertical fakes
│   │
│   └── types/
│       ├── grievance.ts               # the canonical Grievance type
│       └── verticals.ts               # per-vertical config (EU261 facts)
│
└── public/
    └── (favicon, og image, etc.)
```

## Data model

### `Grievance` (the central record)

```ts
interface Grievance {
  id: string;                 // ULID
  userId: string;             // for v1: derived from Telegram chat ID
  category: GrievanceCategory; // "UK_FLIGHT_DELAY" for v1
  status: GrievanceStatus;
  rawDescription: string;     // user's original words (transcribed if voice)

  facts: {
    company?: string;
    incidentDate?: string;
    referenceNumber?: string;
    amountClaimed?: number;
    currency?: string;
    [k: string]: unknown;
  };

  research?: {
    complaintsAddress?: string;
    regulatorName?: string;
    regulatorUrl?: string;
    executiveContact?: { name: string; role: string; linkedinUrl: string };
    relevantStatutes?: string[];
    typicalResponseDays?: number;
  };

  timeline: TimelineEvent[];

  notifyVia: {
    telegram?: { chatId: string };
    email?: string;
  };

  workflowRunId?: string;     // Vercel WDK run ID for deep-linking to observability
  createdAt: string;
  updatedAt: string;
}
```

### `TimelineEvent` (append-only history)

```ts
interface TimelineEvent {
  at: string;                 // ISO timestamp
  kind:
    | "received" | "classified" | "researched" | "drafted"
    | "approval_requested" | "approved" | "edited" | "cancelled"
    | "sent" | "reply_received" | "negotiating" | "escalated"
    | "lesson_learned" | "won" | "lost";
  summary: string;            // one-line human-readable
  payload?: Record<string, unknown>;  // structured details
}
```

### KV schema

```
grievance:{id}               → Grievance JSON
grievance:{id}:timeline      → list of TimelineEvent JSONs (LPUSH)
user:{userId}:grievances     → list of grievance IDs (LPUSH)
approval:{grievanceId}       → pending approval payload (TTL 24h)
chat:state:*                 → ChatSDK Redis state (managed by adapter)
```

## Workflow shape

The whole product is essentially this one durable function:

```ts
import { sleep, getWritable, hookFor } from "workflow";

export async function pursueGrievance(input: {
  grievanceId: string;
  isEscalation?: boolean;
}) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  // 1. Load + memory recall
  const g = await loadGrievance(input.grievanceId);          // step
  const memory = await getMemoryContext({                    // step
    grievanceId: g.id,
    query: `Pursuing ${g.category} against ${g.facts.company ?? "unknown"}`,
  });

  // 2. Research target (Bright Data tools)
  const research = await researchTarget({                    // step (multiple tool calls inside)
    grievance: g,
    memoryContext: memory,
    writable,
  });
  await saveResearch(g.id, research);                        // step

  // 3. Draft letter (Claude Opus + Mubit context)
  const draft = await draftLetter({                          // step
    grievance: g,
    research,
    memoryContext: memory,
    isEscalation: input.isEscalation ?? false,
    writable,
  });

  // 4. Human-in-the-loop approval — workflow PAUSES with no compute
  const approvalHook = hookFor<{ action: "approve" | "edit" | "cancel"; edits?: string }>(
    `approval:${g.id}`
  );
  await postApprovalCardToTelegram(g, draft);                // step
  const decision = await approvalHook.wait({ timeout: "24h" });

  if (!decision || decision.action === "cancel") {
    await markStatus(g.id, "CANCELLED");                     // step
    await reflect({ grievanceId: g.id });                    // step (still learn from cancellations)
    return;
  }

  if (decision.action === "edit") {
    // recurse with the edits as additional context
    return pursueGrievance(input);
  }

  // 5. Send + wait
  await sendComplaintEmail(g.id, draft);                     // step
  await markStatus(g.id, "AWAITING_REPLY");                  // step

  const replyHook = hookFor<InboundReply>(`reply:${g.id}`);
  const replyOrTimeout = await Promise.race([
    replyHook.wait(),
    sleep(`${research.typicalResponseDays ?? 14} days`).then(() => null),
  ]);

  // 6. Branch on reply
  if (!replyOrTimeout) {
    // No reply within deadline → escalate
    return pursueGrievance({ grievanceId: g.id, isEscalation: true });
  }

  const decision2 = await classifyReply(replyOrTimeout, memory);  // step
  switch (decision2.kind) {
    case "ACCEPTANCE":
      await markStatus(g.id, "WON");
      break;
    case "PARTIAL_OFFER":
      await handleNegotiation(g.id, decision2, memory);      // step (may loop)
      break;
    case "REJECTION":
      return pursueGrievance({ grievanceId: g.id, isEscalation: true });
    case "REQUEST_FOR_INFO":
      await respondToInfoRequest(g.id, decision2);           // step
      // re-enter the wait state via recursion or another hook
      break;
  }

  // 7. Close out — Mubit reflection + outcome
  await reflectAndRecord({ grievanceId: g.id });             // step
}
```

Key WDK primitives used:
- `"use workflow"` — the durability declaration
- `"use step"` (in each `await ...` target) — atomic checkpoint
- `sleep("14 days")` — pause without compute
- `hookFor(...)` / `.wait()` — pause until external event (approval or reply)
- `getWritable()` — stream progress updates to clients
- Recursion (`pursueGrievance(...)` from inside itself) — for escalations and edits

## API surfaces

### `POST /api/grievances`

Body: `{ description: string, notifyVia: { telegram?: { chatId: string } } }`
Action: creates the Grievance record, returns its ID, kicks off `pursueGrievance.start({ grievanceId })`.

### `GET /api/grievances/:id`

Returns the full Grievance record + timeline. Used by the dashboard for polling.

### `POST /api/grievances/:id/approve`

Body: `{ action: "approve" | "edit" | "cancel", edits?: string }`
Action: invokes the approval hook to resume the paused workflow.

### `POST /api/webhooks/telegram`

Receives Telegram updates. Routes via ChatSDK to the right handler:
- New grievance description (text or voice)
- Approval card button taps
- Conversational follow-ups ("update me on Wizz Air")

### `POST /api/webhooks/resend`

Receives inbound email replies. Parses, identifies which grievance the reply belongs to (via `Reply-To` address pattern `replies+{grievanceId}@yourdomain.com`), and invokes the reply hook to resume the workflow.

In demo mode, this same endpoint also accepts synthetic payloads from the `simulateReplies` workflow — distinguished by an `x-demo-token` header.

### `POST /api/demo/run` (demo-mode only)

Body: `{ scenario: "easy_win" | "negotiation" | "escalation" }`
Action: Creates a fresh grievance pre-populated with the scenario's seed data, starts `pursueGrievance` in demo mode (with `demoScale: 12_000`), and starts a parallel `simulateReplies` workflow that posts scripted replies to the inbound webhook on a scaled schedule. Gated by `ENABLE_DEMO_MODE=1` env. See `09_DEMO_MODE.md` for full design.

## How the surfaces fit together

```
┌──────────────────────┐                    ┌──────────────────────┐
│   Telegram (phone)   │                    │   Web Dashboard      │
│                      │                    │   (vendetta.app)     │
└─────────┬────────────┘                    └──────────┬───────────┘
          │                                            │
          │  voice/text                                │  POST /api/grievances
          │  POST /api/webhooks/telegram               │
          ▼                                            ▼
   ┌────────────────────────────────────────────────────────┐
   │              Next.js App (Vercel)                       │
   │                                                          │
   │   ChatSDK ──┐                                            │
   │             ├──▶ create Grievance ──▶ pursueGrievance.start()
   │   API route ┘                                            │
   │                                                          │
   │   ┌─────────────────────────────────────────────────┐   │
   │   │     pursueGrievance() ("use workflow")          │   │
   │   │                                                  │   │
   │   │   step → step → hook (pause) → step → sleep(14d)│   │
   │   │     │      │      │              │       │      │   │
   │   │     ▼      ▼      ▼              ▼       ▼      │   │
   │   └─────┬──────┬──────┬──────────────┬───────┬─────┘   │
   │         │      │      │              │       │          │
   └─────────┼──────┼──────┼──────────────┼───────┼──────────┘
             │      │      │              │       │
             ▼      ▼      ▼              ▼       ▼
        ┌────────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌────────────┐
        │ Mubit  │ │Bright│ │ Telegram │ │Resend│ │  Vercel KV │
        │ memory │ │ Data │ │  approval│ │ send │ │  + Workflow│
        │        │ │ MCP  │ │   card   │ │      │ │  observ.   │
        └────────┘ └──────┘ └──────────┘ └──────┘ └────────────┘
                                ▲                      ▲
                                │                      │
                          User taps              Company replies
                          Approve                via inbound webhook
```

## Important architectural decisions

1. **Workflow is the source of truth for execution state.** The KV record mirrors what's user-visible; the workflow's persisted state is what's computationally authoritative. Don't try to reconstruct workflow state from KV.

2. **Each `await stepFunction()` becomes a checkpoint.** Don't put long-running side-effectful logic at workflow scope; push it into steps. If a step fails mid-execution, only that step retries, not the whole workflow.

3. **Hooks > polling.** For both approval (user taps Telegram button) and inbound reply (Resend webhook), use WDK hooks, not polling. The workflow consumes zero compute while waiting.

4. **Mubit is fire-and-forget for writes, blocking for reads.** Wrap `remember()` in `try/catch` so a Mubit outage doesn't break a workflow. `getContext()` is on the critical path; if it fails, fall back to no extra context (the LLM still works).

5. **The dashboard reads, never writes to workflow state directly.** All state mutations go through API routes that either write KV or trigger workflow hooks.

6. **Bright Data tools are passed wholesale to `DurableAgent`.** Don't try to pre-select which tools the LLM uses — let it pick. This is the magic of MCP + tool calling.

7. **Demo mode is honest, not faked.** Workflow sleeps are scaled by a `demoScale` input parameter via the `demoSleep()` helper. Simulated company replies are posted by a parallel `simulateReplies` workflow to the same inbound webhook real replies hit — same code path, same hooks, same observability. The only synthetic thing is the email body content. See `09_DEMO_MODE.md`.

```ts
// src/lib/demo-sleep.ts — used everywhere in pursueGrievance instead of raw sleep()
import { sleep } from "workflow";

export async function demoSleep(realDuration: string, demoScale: number = 1) {
  if (demoScale === 1) return sleep(realDuration);
  const ms = parseDuration(realDuration);
  const scaledMs = Math.max(2000, Math.floor(ms / demoScale));
  return sleep(`${scaledMs}ms`);
}
```

The workflow signature accepts demoScale and threads it through:

```ts
async function pursueGrievance(input: {
  grievanceId: string;
  demoScale?: number;
  isEscalation?: boolean;
}) {
  "use workflow";
  const scale = input.demoScale ?? 1;
  // ...
  await demoSleep("14 days", scale); // 14 days real → ~100s at scale 12_000
}
```
