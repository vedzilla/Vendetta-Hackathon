# Integration: Resend (Outbound + Inbound Email)

The actual letters Vendetta sends. Plus the inbound webhook that wakes the workflow when a company replies.

**Docs:** https://resend.com/docs

## Setup

1. Sign up at https://resend.com (free tier covers everything).
2. Either:
   - **Verify your own domain** (recommended; takes ~30 minutes for DNS to propagate). Set `RESEND_FROM_ADDRESS=vendetta@yourdomain.com`.
   - **Use the sandbox** for the demo. Set `RESEND_FROM_ADDRESS=onboarding@resend.dev`. Note: sandbox can only email *you* (the account owner), not arbitrary recipients. For the demo this is fine because you'll be sending to your own catch-all address as a stand-in for the airline.
3. Set up an inbound endpoint (Resend → Inbound → Add endpoint) pointing to:
   ```
   https://vendetta.vercel.app/api/webhooks/resend
   ```
4. Configure a catch-all forwarder so `replies+ANYTHING@yourdomain.com` lands at the inbound webhook.

```bash
pnpm add resend
```

## Outbound send (`src/lib/resend.ts`)

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

interface SendComplaintArgs {
  to: string;
  subject: string;
  body: string;          // markdown or plain text
  grievanceId: string;   // used in Reply-To for routing inbound replies
}

export async function sendComplaint(args: SendComplaintArgs) {
  const replyTo = `replies+${args.grievanceId}@${process.env.RESEND_REPLY_DOMAIN}`;

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_ADDRESS!,
    to: args.to,
    replyTo,                      // ← critical: this is how we route inbound replies
    subject: args.subject,
    text: args.body,              // also send html: markdownToHtml(args.body) for niceness
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }

  return { messageId: result.data?.id };
}
```

## Outbound step in the workflow

```ts
// src/workflows/steps/send-email.ts
import { sendComplaint } from "@/lib/resend";
import { remember } from "@/lib/mubit";
import { appendTimeline } from "@/lib/store";

export async function sendComplaintEmail(args: {
  grievanceId: string;
  research: Grievance["research"];
  draft: { subject: string; body: string };
}) {
  "use step";

  if (!args.research?.complaintsAddress) {
    throw new Error("No complaints address discovered");
  }

  const { messageId } = await sendComplaint({
    to: args.research.complaintsAddress,
    subject: args.draft.subject,
    body: args.draft.body,
    grievanceId: args.grievanceId,
  });

  await appendTimeline(args.grievanceId, {
    at: new Date().toISOString(),
    kind: "sent",
    summary: `Sent first complaint to ${args.research.complaintsAddress}`,
    payload: { messageId, subject: args.draft.subject },
  });

  await remember({
    grievanceId: args.grievanceId,
    content: `Sent complaint to ${args.research.complaintsAddress} on ${new Date().toISOString()}. Subject: ${args.draft.subject}.`,
    intent: "trace",
  });

  return { messageId };
}
```

## Inbound webhook (`src/app/api/webhooks/resend/route.ts`)

```ts
import { z } from "zod";
import { invokeHook } from "workflow";
import { appendTimeline, loadGrievance } from "@/lib/store";
import { remember } from "@/lib/mubit";

const InboundSchema = z.object({
  type: z.literal("email.delivered.inbound"),  // adjust to match Resend's payload shape
  data: z.object({
    from: z.string(),
    to: z.string(),
    subject: z.string(),
    text: z.string(),
    html: z.string().optional(),
    receivedAt: z.string(),
  }),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = InboundSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("[resend webhook] unexpected payload", parsed.error);
    return Response.json({ ok: false }, { status: 400 });
  }

  // Extract grievanceId from the To address: replies+{id}@yourdomain.com
  const match = parsed.data.data.to.match(/replies\+([^@]+)@/);
  const grievanceId = match?.[1];
  if (!grievanceId) {
    console.warn("[resend webhook] no grievance ID in To address", parsed.data.data.to);
    return Response.json({ ok: false }, { status: 200 });
  }

  // Resume the workflow
  await invokeHook(`reply:${grievanceId}`, {
    from: parsed.data.data.from,
    subject: parsed.data.data.subject,
    body: parsed.data.data.text,
    receivedAt: parsed.data.data.receivedAt,
  });

  await appendTimeline(grievanceId, {
    at: new Date().toISOString(),
    kind: "reply_received",
    summary: `Reply received from ${parsed.data.data.from}`,
    payload: { subject: parsed.data.data.subject },
  });

  await remember({
    grievanceId,
    content: `Received reply from ${parsed.data.data.from} on ${parsed.data.data.receivedAt}. Subject: ${parsed.data.data.subject}. Body: ${parsed.data.data.text.slice(0, 500)}`,
    intent: "trace",
  });

  return Response.json({ ok: true });
}
```

## Demo-day fallback for inbound

In the demo, you won't actually wait 14 days for an airline to reply. Add a dev-only endpoint that simulates an incoming reply:

```ts
// src/app/api/dev/simulate-reply/route.ts
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !req.headers.get("x-dev-token")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { grievanceId, kind } = await req.json();
  // kind: "ACCEPTANCE" | "PARTIAL_OFFER" | "REJECTION" | "REQUEST_FOR_INFO"

  const fakeReplies = {
    ACCEPTANCE: "We have reviewed your case and approved a refund of £220.",
    PARTIAL_OFFER: "We can offer £80 as a goodwill gesture.",
    REJECTION: "We regret your claim falls outside the scope of EC 261/2004.",
    REQUEST_FOR_INFO: "Please provide your boarding pass and the original booking confirmation.",
  };

  await invokeHook(`reply:${grievanceId}`, {
    from: "no-reply@wizzair.com",
    subject: "Re: Your complaint",
    body: fakeReplies[kind],
    receivedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
```

Add a dev panel to the dashboard with "Simulate ACCEPTANCE / PARTIAL / REJECTION" buttons for each campaign — this is how you run live demos in 2 minutes that would otherwise take 2 weeks.

## Avoiding spam filter problems

For real outbound:
- Set up SPF, DKIM, DMARC on your domain (Resend gives you the records to add).
- Don't send too many in rapid succession (max 1 per minute per recipient).
- Keep subject lines professional and specific ("Compensation claim — Wizz Air W6-1234, 2026-04-15"), not "URGENT REFUND".
- Include the reference number in the subject and body.

For the demo this barely matters because you're sending to test addresses.
