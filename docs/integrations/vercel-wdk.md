# Integration: Vercel Workflow Development Kit (WDK)

This is the spine of Vendetta. It's what makes "pursue a grievance for 3 weeks" possible without writing queues.

**Docs:** https://workflow-sdk.dev/docs
**LLM-friendly index:** https://workflow-sdk.dev/llms.txt
**Vercel deploy docs:** https://vercel.com/docs/workflows
**DurableAgent docs:** https://workflow-sdk.dev/docs/api-reference/workflow-ai/durable-agent

## Setup (one-time)

1. Install: `pnpm add workflow @workflow/ai`
2. Wrap `next.config.ts`:

```ts
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // your existing config
};

export default withWorkflow(nextConfig);
```

3. On Vercel, the Workflow integration auto-provisions queues, persistence, and observability. Locally, the Local World provides virtual infrastructure — no Postgres/Redis needed for dev.

## The two directives

### `"use workflow"`
Marks a function as a durable workflow. Each `await` inside becomes a recovery point. The function can sleep, suspend, and resume across deploys and crashes.

### `"use step"`
Marks a function as an atomic step. Failed steps retry automatically (configurable). Successful steps are never re-executed even if the workflow restarts.

```ts
async function fetchOrderDetails(orderId: string) {
  "use step";
  // network call, side effect, etc. — retried on failure, cached on success
  return await api.getOrder(orderId);
}

async function processOrder(orderId: string) {
  "use workflow";
  const order = await fetchOrderDetails(orderId);  // checkpoint
  await sleep("1 day");                             // pause without compute
  await sendReminder(order);                        // checkpoint
}
```

## Starting workflows

```ts
import { pursueGrievance } from "@/workflows/pursue-grievance";

// From an API route or server action:
const { runId } = await pursueGrievance.start({ grievanceId });

// Save runId on the Grievance record so the dashboard can deep-link to
// /workflows/{runId} in the Vercel observability dashboard.
```

## Hooks (waiting for external events)

This is how we wait for user approval AND inbound email replies without consuming compute.

```ts
import { hookFor } from "workflow";

// Inside a workflow:
const approvalHook = hookFor<{ action: "approve" | "edit" | "cancel" }>(
  `approval:${grievanceId}`
);

// This pauses the workflow indefinitely (or until timeout).
const decision = await approvalHook.wait({ timeout: "24h" });
```

To resume the workflow from elsewhere (e.g. an API route handling a Telegram button tap):

```ts
import { invokeHook } from "workflow";

// In /api/grievances/[id]/approve/route.ts:
await invokeHook(`approval:${grievanceId}`, { action: "approve" });
```

## Sleep

```ts
import { sleep } from "workflow";

await sleep("14 days");  // accepts "30s", "5m", "2h", "7 days", etc.
// Workflow uses zero compute during this. Resumes automatically when the time elapses.
```

## DurableAgent (the AI agent loop)

This is the magic class for AI agents that need durability + tool calling + streaming.

```ts
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";
import { reasoningModel } from "@/lib/ai";
import { getBrightDataTools } from "@/lib/brightdata";

async function researchTarget(grievance: Grievance) {
  "use workflow";

  const brightDataTools = await getBrightDataTools();
  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: reasoningModel,                            // claude-opus-4-7 via Gateway
    instructions: `
You are a research agent for a consumer-rights pursuit. Find:
1. The official complaints email for ${grievance.facts.company}
2. The relevant UK / EU regulator
3. The exact statute articles to cite
Use the tools available. Return structured JSON.
    `.trim(),
    tools: brightDataTools,                           // 50 web tools
  });

  const result = await agent.stream({
    messages: [{ role: "user", content: grievance.rawDescription }],
    writable,
  });

  return result.messages;  // contains tool calls + final structured response
}
```

The `agent.stream()` call:
- Iterates the model loop until completion (potentially dozens of tool calls).
- Each tool call is a step under the hood — failed tool calls retry, completed ones never re-run.
- Streams progress to the `writable` so the dashboard can show "Searching for Wizz Air complaints page..." live.
- Survives deploys, crashes, and timeouts. A 50-step research session that takes 4 minutes will not be lost mid-stream.

## Resumable streams

For the dashboard's live progress display:

```ts
import { getWritable } from "workflow";

async function someStep() {
  "use step";
  const writable = getWritable<{ message: string }>();
  await writable.write({ message: "Searching company website..." });
  // ...do work...
  await writable.write({ message: "Found complaints address." });
}
```

Multiple clients can connect to the same stream. If the user closes the browser, the stream persists; when they come back, the dashboard reconnects and resumes from where it left off.

## Human-in-the-loop pattern (full)

This is the canonical pattern for the approval card. Both terminals will use this.

```ts
async function pursueGrievance({ grievanceId }: { grievanceId: string }) {
  "use workflow";

  // 1. Generate a draft
  const draft = await draftLetter(grievanceId);  // step

  // 2. Post the approval card to Telegram
  await postApprovalCard(grievanceId, draft);    // step (sends Telegram message)

  // 3. Pause indefinitely waiting for the user's tap
  const hook = hookFor<{ action: "approve" | "edit" | "cancel"; edits?: string }>(
    `approval:${grievanceId}`
  );
  const decision = await hook.wait({ timeout: "24h" });

  // 4. Branch on the decision
  if (!decision || decision.action === "cancel") {
    await markCancelled(grievanceId);
    return;
  }

  if (decision.action === "edit") {
    // recurse with the edits as new context
    await applyEdits(grievanceId, decision.edits);
    return pursueGrievance({ grievanceId });
  }

  // 5. Send and continue
  await sendEmail(grievanceId, draft);
  // ... rest of workflow
}
```

## Webhook-based hook resolution

For inbound Resend replies, the webhook handler does:

```ts
// In /api/webhooks/resend/route.ts
import { invokeHook } from "workflow";

export async function POST(req: Request) {
  const payload = await req.json();
  // ... parse payload, find grievanceId from the Reply-To address ...
  await invokeHook(`reply:${grievanceId}`, { from, subject, body, receivedAt });
  return Response.json({ ok: true });
}
```

The workflow that's been sleeping/waiting on `reply:${grievanceId}` immediately wakes and resumes.

## Observability

When deployed to Vercel, every workflow run, step, sleep, hook, and stream chunk is automatically logged. Visit `vercel.com/<team>/<project>/workflows` to see runs.

For the demo: this dashboard is your secret weapon. Open it in a tab during the pitch — point at a real campaign that's been running for 3 days, click into the trace, show the judges the timeline of steps with timestamps.

## Things to NOT do

- Don't put `await fetch()` directly inside a workflow without wrapping it as a step. You lose retries and cacheability.
- Don't use `setTimeout` or `setInterval` inside a workflow. Use `sleep()`.
- Don't try to share variables between unrelated workflow runs via global state. Use Mubit for cross-run memory.
- Don't deploy with `deploymentId: "current"` if you want long-running workflows to upgrade automatically. Use `deploymentId: "latest"` so a 14-day sleep wakes onto whatever code is currently deployed, not week-old code.

## Common errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot await non-step function` | You called a regular async function from a workflow without it being a step. | Add `"use step"` to the inner function. |
| `Hook timed out` | The hook never received an invocation within the timeout. | Either extend the timeout or ensure your webhook handler calls `invokeHook`. |
| `Workflow run frozen at step X` | Step is throwing repeatedly. | Check the step's error in `/workflows` observability. May need `FatalError` to stop retries. |
