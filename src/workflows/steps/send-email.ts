/**
 * Send the drafted complaint via Resend. The Reply-To header carries the
 * grievance id so inbound replies route deterministically back to us.
 */

import type { DraftLetter } from "./draft-letter";

import { remember } from "@/lib/mubit";
import { sendComplaintEmail } from "@/lib/resend";
import { appendTimelineEvent } from "@/lib/store";

import type { GrievanceResearch } from "@/types/grievance";

export async function sendComplaintEmailStep(input: {
  grievanceId: string;
  research: GrievanceResearch;
  draft: DraftLetter;
}): Promise<{ messageId: string }> {
  "use step";

  const recipient = input.research.complaintsAddress;
  if (!recipient) {
    throw new Error(
      `sendComplaintEmail: no complaints address known for grievance ${input.grievanceId}`,
    );
  }

  const result = await sendComplaintEmail({
    to: recipient,
    subject: input.draft.subject,
    bodyText: input.draft.body,
    grievanceId: input.grievanceId,
  });

  await appendTimelineEvent(input.grievanceId, {
    at: result.sentAt,
    kind: "sent",
    summary: `Sent to ${recipient} — "${input.draft.subject}"`,
    payload: { messageId: result.messageId, recipient },
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "decision",
    content: `Sent complaint to ${recipient} at ${result.sentAt}. Subject: "${input.draft.subject}".`,
    metadata: { messageId: result.messageId },
  });

  return { messageId: result.messageId };
}
