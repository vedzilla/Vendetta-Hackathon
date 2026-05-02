/**
 * Handle a partial offer. The agent decides whether to accept or counter,
 * informed by the canonical compensation entitlement and prior lessons.
 *
 * For the hackathon scope this always counters (the demo's negotiation
 * scenario depends on it), but the decision is made by the LLM rather
 * than hardcoded — so the workflow trace shows real reasoning.
 *
 * After sending the counter, the step returns; the shell does NOT auto-loop
 * here — the next inbound reply re-enters the main wait via the demo
 * orchestrator (or in production, the next genuine reply).
 */

import { generateObject } from "ai";
import { z } from "zod";

import { reasoningModel } from "@/lib/ai";
import { remember, type MubitLesson } from "@/lib/mubit";
import { sendComplaintEmail } from "@/lib/resend";
import { appendTimelineEvent, loadGrievance, markStatus } from "@/lib/store";

const CounterSchema = z.object({
  decision: z.enum(["ACCEPT", "COUNTER"]),
  subject: z.string().min(8),
  body: z.string().min(80),
  rationale: z.string().min(8),
});

export async function handleNegotiationStep(input: {
  grievanceId: string;
  offerAmount?: number;
  memoryText: string;
  memoryLessons: MubitLesson[];
  demoScale: number;
}): Promise<void> {
  "use step";

  const grievance = await loadGrievance(input.grievanceId);
  const entitled = grievance.facts.amountClaimed;
  const offer = input.offerAmount;

  const memoryBlock = [
    input.memoryText,
    ...input.memoryLessons.map((l, i) => `  ${i + 1}. ${l.text}`),
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await generateObject({
    model: reasoningModel,
    schema: CounterSchema,
    system: [
      "You are negotiating on behalf of a consumer who has been offered a partial",
      "settlement. Decide whether to ACCEPT (offer is fair, end the campaign) or",
      "COUNTER (offer is below entitlement; reply firmly citing the statute).",
      "",
      "If COUNTER, the body should: acknowledge receipt of the offer, restate the",
      "full statutory entitlement with the article number, decline the partial offer,",
      "and request the full amount within 14 days. UK English. No threats.",
      "",
      "Return strict JSON: { decision, subject, body, rationale }.",
    ].join("\n"),
    prompt: [
      `Grievance against: ${grievance.facts.company ?? "unknown"}`,
      `User's claimed entitlement: ${entitled ? `£${entitled}` : "(unknown)"}`,
      `Offer received: ${offer != null ? `£${offer}` : "(unspecified)"}`,
      "",
      "Prior lessons:",
      memoryBlock || "(none)",
    ].join("\n"),
  });

  const recipient = grievance.research?.complaintsAddress;
  if (!recipient) {
    throw new Error(`negotiation: no complaints address on file for ${input.grievanceId}`);
  }

  if (object.decision === "ACCEPT") {
    await markStatus(input.grievanceId, "WON");
    await appendTimelineEvent(input.grievanceId, {
      at: new Date().toISOString(),
      kind: "won",
      summary: `Accepted partial offer of £${offer ?? "?"} — ${object.rationale}`,
      payload: { offerAmount: offer, rationale: object.rationale },
    });
    await remember({
      grievanceId: input.grievanceId,
      kind: "outcome",
      content: `Accepted partial offer of £${offer ?? "?"}. Rationale: ${object.rationale}`,
    });
    return;
  }

  // COUNTER → send a firm reply.
  await markStatus(input.grievanceId, "NEGOTIATING");

  const result = await sendComplaintEmail({
    to: recipient,
    subject: object.subject,
    bodyText: object.body,
    grievanceId: input.grievanceId,
  });

  await appendTimelineEvent(input.grievanceId, {
    at: result.sentAt,
    kind: "negotiating",
    summary: `Countered partial offer of £${offer ?? "?"} — sent firm reply citing entitlement`,
    payload: {
      offerAmount: offer,
      messageId: result.messageId,
      rationale: object.rationale,
    },
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "decision",
    content: `Countered ${offer != null ? `£${offer}` : "partial"} offer. Rationale: ${object.rationale}`,
    metadata: { messageId: result.messageId },
  });
}
