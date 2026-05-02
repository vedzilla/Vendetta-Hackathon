/**
 * Resend — outbound email send + inbound reply parsing.
 *
 * Outbound: every send sets Reply-To to `replies+{grievanceId}@{domain}`
 * so inbound replies route deterministically back to the right campaign.
 *
 * Inbound: the Resend webhook hits /api/webhooks/resend. Synthetic demo
 * replies hit the same endpoint (distinguished by an x-demo-token header)
 * and produce the same InboundReply shape — the workflow can't tell which
 * is which, which is the whole point of demo mode.
 */

import { Resend } from "resend";
import { z } from "zod";

import type { InboundReply } from "@/types/grievance";

let _resend: Resend | null = null;

function client(): Resend {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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

export async function sendComplaintEmail(letter: OutboundLetter): Promise<SendResult> {
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  const replyDomain = process.env.RESEND_REPLY_DOMAIN;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not set");
  if (!replyDomain) throw new Error("RESEND_REPLY_DOMAIN is not set");

  const replyTo = `replies+${letter.grievanceId}@${replyDomain}`;

  const result = await client().emails.send({
    from: fromAddress,
    to: letter.to,
    replyTo,
    subject: letter.subject,
    text: letter.bodyText,
    ...(letter.bodyHtml ? { html: letter.bodyHtml } : {}),
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  if (!result.data?.id) {
    throw new Error("Resend send returned no message id");
  }

  return {
    messageId: result.data.id,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Resend's inbound webhook payload. We don't lock onto an exact event type
 * because Resend has shipped a few variants; we just need from/to/subject/text.
 */
const InboundDataSchema = z.object({
  from: z.union([
    z.string(),
    z.object({ email: z.string(), name: z.string().optional() }).transform((v) => v.email),
  ]),
  to: z.union([
    z.string(),
    z.array(z.string()).transform((v) => v[0] ?? ""),
  ]),
  subject: z.string().default(""),
  text: z.string().optional(),
  html: z.string().optional(),
  receivedAt: z.string().optional(),
  created_at: z.string().optional(),
});

const InboundEnvelopeSchema = z.object({
  type: z.string().optional(),
  data: InboundDataSchema,
});

/** Pull the grievance id out of `replies+{id}@domain`. */
export function extractGrievanceId(toAddress: string): string | null {
  const match = toAddress.match(/replies\+([^@]+)@/i);
  return match?.[1] ?? null;
}

/**
 * Normalise the Resend (or demo) inbound webhook body into our InboundReply
 * shape. Throws on a malformed payload — the caller should return a 400.
 */
export function parseInboundWebhook(payload: unknown): InboundReply {
  const parsed = InboundEnvelopeSchema.parse(payload);

  const grievanceId = extractGrievanceId(parsed.data.to);
  if (!grievanceId) {
    throw new Error(`Inbound reply missing grievance id in To: ${parsed.data.to}`);
  }

  const body = parsed.data.text ?? parsed.data.html ?? "";
  const receivedAt = parsed.data.receivedAt ?? parsed.data.created_at ?? new Date().toISOString();

  return {
    grievanceId,
    from: parsed.data.from,
    subject: parsed.data.subject,
    body,
    receivedAt,
  };
}
