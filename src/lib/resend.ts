/**
 * Resend — outbound email send + inbound reply parsing.
 * Inbound webhook lives at /api/webhooks/resend. Synthetic demo replies hit
 * the same endpoint distinguished by the x-demo-token header.
 *
 * Implementation in Block A→B (Terminal 1).
 */

import type { InboundReply } from "@/types/grievance";

export interface OutboundLetter {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  /** Drives the Reply-To pattern replies+{grievanceId}@{domain}. */
  grievanceId: string;
}

export interface SendResult {
  messageId: string;
  sentAt: string;
}

export async function sendComplaintEmail(_letter: OutboundLetter): Promise<SendResult> {
  throw new Error("not implemented: sendComplaintEmail");
}

export function parseInboundWebhook(_payload: unknown): InboundReply {
  throw new Error("not implemented: parseInboundWebhook");
}
