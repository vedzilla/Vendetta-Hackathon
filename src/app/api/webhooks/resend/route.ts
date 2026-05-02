/**
 * POST /api/webhooks/resend — inbound email replies (real + simulated).
 *
 * Real path: Resend posts a delivered.inbound event. The Reply-To address
 * carries the grievance id (`replies+{id}@domain`) which we extract.
 *
 * Demo path: simulate-replies POSTs the same shape with `x-demo-token` so
 * the workflow code path is identical.
 *
 * Either way: parse → resume `reply:{grievanceId}` → record timeline.
 */

import { NextResponse } from "next/server";

import { resumeHook } from "workflow/api";

import { remember } from "@/lib/mubit";
import { parseInboundWebhook } from "@/lib/resend";
import { appendTimelineEvent } from "@/lib/store";

export async function POST(req: Request) {
  // In production, only accept either: (a) a real Resend webhook (verified
  // by signature in a hardened build), or (b) a demo payload bearing the
  // server-only DEMO_TOKEN. For the hackathon we accept the demo token alone
  // — Resend signature verification is post-hackathon scope.
  const demoToken = req.headers.get("x-demo-token");
  const expectedDemoToken = process.env.DEMO_TOKEN;
  const isDemo = demoToken && expectedDemoToken && demoToken === expectedDemoToken;

  if (process.env.NODE_ENV === "production" && demoToken && !isDemo) {
    return NextResponse.json({ error: "Invalid demo token" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let reply;
  try {
    reply = parseInboundWebhook(payload);
  } catch (e) {
    return NextResponse.json(
      { error: "Could not parse inbound webhook", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  // Resume the workflow waiting on this grievance's reply hook. If no hook
  // exists (e.g. the campaign already closed), we still log the inbound
  // event so the dashboard can show out-of-band replies.
  try {
    await resumeHook(`reply:${reply.grievanceId}`, reply);
  } catch (e) {
    console.warn(
      `[webhook resend] no paused workflow for reply:${reply.grievanceId}`,
      e instanceof Error ? e.message : e,
    );
  }

  await appendTimelineEvent(reply.grievanceId, {
    at: reply.receivedAt,
    kind: "reply_received",
    summary: `Reply received from ${reply.from}${isDemo ? " (demo)" : ""}`,
    payload: { from: reply.from, subject: reply.subject, isDemo: !!isDemo },
  });

  await remember({
    grievanceId: reply.grievanceId,
    kind: "fact",
    content: `Inbound reply from ${reply.from} on ${reply.receivedAt}. Subject: "${reply.subject}". Body: ${reply.body.slice(0, 600)}`,
  });

  return NextResponse.json({ ok: true, demo: !!isDemo });
}
