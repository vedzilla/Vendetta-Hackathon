/**
 * Demo-mode parallel workflow. Walks the scripted reply beats for a
 * scenario, sleeping (scaled by demoScale) before each, then POSTing a
 * synthetic Resend-shaped payload to /api/webhooks/resend.
 *
 * Two reasons this is itself a workflow rather than a setTimeout chain:
 *  1. Durability — the demo can survive a redeploy mid-pitch.
 *  2. Visibility — judges can open the Vercel observability tab and see
 *     two concurrent runs (the campaign + its replies), both real.
 *
 * The webhook handler keys off `x-demo-token` to accept these payloads;
 * in production without the token, only Resend can post.
 */

import { fetch } from "workflow";

import { demoSleep } from "@/lib/demo-sleep";
import { getScenario, type ScenarioKey } from "@/lib/demo-scenarios";

export interface SimulateRepliesInput {
  grievanceId: string;
  scenario: ScenarioKey;
  demoScale: number;
}

async function postSimulatedReply(input: {
  grievanceId: string;
  from: string;
  subject: string;
  body: string;
}): Promise<void> {
  "use step";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!baseUrl) {
    throw new Error("simulate-replies: NEXT_PUBLIC_APP_URL or VERCEL_URL must be set");
  }
  const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const replyDomain = process.env.RESEND_REPLY_DOMAIN ?? "vendetta.app";
  const demoToken = process.env.DEMO_TOKEN;
  if (!demoToken) {
    throw new Error("simulate-replies: DEMO_TOKEN must be set to inject synthetic replies");
  }

  const res = await fetch(`${url}/api/webhooks/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-token": demoToken,
    },
    body: JSON.stringify({
      type: "email.delivered.inbound",
      data: {
        from: input.from,
        to: `replies+${input.grievanceId}@${replyDomain}`,
        subject: input.subject,
        text: input.body,
        receivedAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `simulate-replies: webhook POST failed ${res.status}: ${detail.slice(0, 200)}`,
    );
  }
}

export async function simulateReplies(input: SimulateRepliesInput): Promise<void> {
  "use workflow";

  const script = getScenario(input.scenario);

  for (const beat of script.beats) {
    await demoSleep(beat.afterDelay, input.demoScale);
    await postSimulatedReply({
      grievanceId: input.grievanceId,
      from: beat.from,
      subject: beat.subject,
      body: beat.body,
    });
  }
}
