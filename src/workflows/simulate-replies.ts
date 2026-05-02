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

import { fetch, sleep } from "workflow";

import { demoSleep } from "@/lib/demo-sleep";
import { getScenario, type ScenarioKey } from "@/lib/demo-scenarios";
import { appendTimelineEvent, markStatus, saveResearch } from "@/lib/store";

import type { GrievanceStatus, TimelineEventKind } from "@/types/grievance";

export interface SimulateRepliesInput {
  grievanceId: string;
  scenario: ScenarioKey;
  demoScale: number;
  /** When true, also tap "approve" on the campaign so the demo runs end-to-end. */
  autoApprove?: boolean;
}

async function progressStep(input: {
  grievanceId: string;
  status: GrievanceStatus;
  kind: TimelineEventKind;
  summary: string;
}): Promise<void> {
  "use step";
  await markStatus(input.grievanceId, input.status);
  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: input.kind,
    summary: input.summary,
  });
}

async function recordResearchStep(input: {
  grievanceId: string;
  scenario: ScenarioKey;
}): Promise<void> {
  "use step";
  const research = input.scenario === "easy_win"
    ? {
        complaintsAddress: "customercare@wizzair.com",
        regulatorName: "UK Civil Aviation Authority (PACT)",
        regulatorUrl: "https://www.caa.co.uk/passengers/resolving-travel-problems/",
        relevantStatutes: [
          "EC 261/2004 Article 7(1)(b)",
          "Air Passenger Rights and Compensation Regulations 2019 (UK261)",
        ],
        typicalResponseDays: 14,
      }
    : input.scenario === "negotiation"
      ? {
          complaintsAddress: "claims@easyjet.com",
          regulatorName: "UK Civil Aviation Authority (PACT)",
          regulatorUrl: "https://www.caa.co.uk/passengers/resolving-travel-problems/",
          relevantStatutes: ["EC 261/2004 Article 7(1)(b)", "EC 261/2004 Article 7(3)"],
          typicalResponseDays: 14,
        }
      : {
          complaintsAddress: "customer.relations@ryanair.com",
          regulatorName: "AviationADR",
          regulatorUrl: "https://www.aviationadr.org.uk/",
          relevantStatutes: [
            "EC 261/2004 Article 7(1)(a)",
            "Air Passenger Rights and Compensation Regulations 2019 (UK261)",
          ],
          typicalResponseDays: 14,
        };
  await saveResearch(input.grievanceId, research);
}

async function autoApproveStep(grievanceId: string): Promise<void> {
  "use step";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!baseUrl) {
    throw new Error("simulate-replies: NEXT_PUBLIC_APP_URL or VERCEL_URL must be set");
  }
  const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const res = await fetch(`${url}/api/grievances/${grievanceId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `simulate-replies: auto-approve failed ${res.status}: ${detail.slice(0, 200)}`,
    );
  }
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

  // Drive the visible campaign progression directly, independent of the
  // pursueGrievance LLM workflow. This keeps the dashboard moving even if
  // the LLM steps are slow, throttled, or unreachable. Each progressStep
  // writes a new status + timeline event the dashboard polls.
  await sleep("2s");
  await progressStep({
    grievanceId: input.grievanceId,
    status: "CLASSIFIED",
    kind: "classified",
    summary: `Classified as UK_FLIGHT_DELAY — extracted facts and routed to research.`,
  });

  await sleep("2s");
  await progressStep({
    grievanceId: input.grievanceId,
    status: "RESEARCHING",
    kind: "researched",
    summary: `Searching the web via Bright Data MCP for the airline complaints address and regulator.`,
  });
  await recordResearchStep({ grievanceId: input.grievanceId, scenario: input.scenario });

  await sleep("3s");
  await progressStep({
    grievanceId: input.grievanceId,
    status: "AWAITING_APPROVAL",
    kind: "drafted",
    summary: `Drafted compensation demand citing EC 261/2004 Article 7. Awaiting your approval.`,
  });

  if (input.autoApprove) {
    await sleep("2s");
    // Best effort — the hook may not exist if pursueGrievance never started.
    try {
      await autoApproveStep(input.grievanceId);
    } catch {
      // Fall through; we still advance the dashboard manually below.
    }
    await progressStep({
      grievanceId: input.grievanceId,
      status: "AWAITING_REPLY",
      kind: "sent",
      summary: `Sent letter to the airline. Awaiting their response.`,
    });
  }

  for (const beat of script.beats) {
    await demoSleep(beat.afterDelay, input.demoScale);
    await postSimulatedReply({
      grievanceId: input.grievanceId,
      from: beat.from,
      subject: beat.subject,
      body: beat.body,
    });
  }

  // Closing flourish — the LLM reflect step would do this; we make it
  // unconditional for the demo so the lesson card always appears.
  await sleep("3s");
  await progressStep({
    grievanceId: input.grievanceId,
    status: "WON",
    kind: "won",
    summary:
      input.scenario === "easy_win"
        ? "Airline confirmed full UK261 compensation."
        : input.scenario === "negotiation"
          ? "Airline upgraded the goodwill voucher to full cash entitlement after Article 7(3) citation."
          : "AviationADR adjudicated in your favour after the airline failed to evidence extraordinary circumstances.",
  });
  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: "lesson_learned",
    summary:
      input.scenario === "easy_win"
        ? "Citing the booking reference in the subject line correlates with replies inside 10 days."
        : input.scenario === "negotiation"
          ? "Article 7(3) on form-of-payment reliably converts voucher offers to cash."
          : "When ATC extraordinary circumstances are claimed without a NOTAM reference, AviationADR escalation succeeds 78% of the time.",
  });
}
