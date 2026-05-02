/**
 * The company asked for additional information (boarding pass, booking
 * confirmation, etc.). For v1 we send a brief acknowledgement back via the
 * same Reply-To routing so the campaign stays alive in their queue, and
 * surface a "needs your input" event on the timeline so the user can attach
 * documents from the dashboard later.
 *
 * Real document attachment is post-hackathon — for the demo this step
 * keeps the conversation breathing rather than letting it die.
 */

import { remember } from "@/lib/mubit";
import { sendComplaintEmail } from "@/lib/resend";
import { appendTimelineEvent, loadGrievance, markStatus } from "@/lib/store";

import type { ClassifiedReply } from "@/types/grievance";

export async function respondToInfoRequestStep(input: {
  grievanceId: string;
  classification: ClassifiedReply;
}): Promise<void> {
  "use step";

  const grievance = await loadGrievance(input.grievanceId);
  const recipient = grievance.research?.complaintsAddress;
  if (!recipient) {
    throw new Error(`respond-to-info: no complaints address for ${input.grievanceId}`);
  }

  const subject = `Re: ${grievance.facts.referenceNumber ?? grievance.id} — supporting documents to follow`;
  const body = [
    "Thank you for your reply.",
    "",
    "I am gathering the documents you have requested and will forward them within",
    "five working days. Please treat this acknowledgement as keeping my claim active",
    "within your customer-care SLA.",
    "",
    `Reference: ${grievance.facts.referenceNumber ?? grievance.id}`,
  ].join("\n");

  const result = await sendComplaintEmail({
    to: recipient,
    subject,
    bodyText: body,
    grievanceId: input.grievanceId,
  });

  await markStatus(input.grievanceId, "AWAITING_REPLY");

  await appendTimelineEvent(input.grievanceId, {
    at: result.sentAt,
    kind: "negotiating",
    summary: `Acknowledged info request — keeping claim active. (${input.classification.summary})`,
    payload: { messageId: result.messageId, infoRequest: input.classification.summary },
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "decision",
    content: `Acknowledged company info request and kept the claim alive. Original ask: ${input.classification.summary}`,
  });
}
