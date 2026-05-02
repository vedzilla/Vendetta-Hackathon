/**
 * POST /api/demo/inject-reply — manual reply injector for stage rescue.
 *
 * Body: { grievanceId, kind: "ACCEPTANCE"|"PARTIAL_OFFER"|"REJECTION"|"REQUEST_FOR_INFO", offerAmount? }
 *
 * Wraps a hand-picked reply body in the Resend webhook shape and POSTs it
 * back through the real /api/webhooks/resend with x-demo-token. Useful when
 * a scripted scenario has run, the campaign closed, and you want to
 * drive ad-hoc behaviour from the dev panel without restarting.
 *
 * Gated by ENABLE_DEMO_MODE.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  grievanceId: z.string().min(1),
  kind: z.enum(["ACCEPTANCE", "PARTIAL_OFFER", "REJECTION", "REQUEST_FOR_INFO"]),
  offerAmount: z.number().optional(),
  from: z.string().optional(),
});

const FALLBACK_BODIES: Record<z.infer<typeof BodySchema>["kind"], (offer?: number) => string> = {
  ACCEPTANCE: (offer) =>
    `Dear Passenger,\n\nWe have reviewed your case and approved a refund of £${offer ?? 220} to your original payment method, processed within 7-10 business days.\n\nCustomer Care`,
  PARTIAL_OFFER: (offer) =>
    `Dear Customer,\n\nAs a goodwill gesture we are pleased to offer £${offer ?? 80} as a final settlement of your claim.\n\nCustomer Service`,
  REJECTION: () =>
    `Dear Passenger,\n\nWe regret your claim falls outside the scope of EC 261/2004 due to extraordinary circumstances. This is our final response.\n\nCustomer Service`,
  REQUEST_FOR_INFO: () =>
    `Dear Passenger,\n\nPlease provide your boarding pass image and the original booking confirmation so we can progress your claim.\n\nCustomer Service`,
};

export async function POST(req: Request) {
  if (process.env.ENABLE_DEMO_MODE !== "1") {
    return NextResponse.json({ error: "Demo mode disabled" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "App URL not configured" }, { status: 500 });
  }
  const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const replyDomain = process.env.RESEND_REPLY_DOMAIN ?? "vendetta.app";
  const demoToken = process.env.DEMO_TOKEN;
  if (!demoToken) {
    return NextResponse.json(
      { error: "DEMO_TOKEN must be set to inject replies" },
      { status: 500 },
    );
  }

  const replyBody = FALLBACK_BODIES[parsed.data.kind](parsed.data.offerAmount);

  const res = await fetch(`${url}/api/webhooks/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-token": demoToken,
    },
    body: JSON.stringify({
      type: "email.delivered.inbound",
      data: {
        from: parsed.data.from ?? "no-reply@example-airline.com",
        to: `replies+${parsed.data.grievanceId}@${replyDomain}`,
        subject: `Re: Manual injection — ${parsed.data.kind}`,
        text: replyBody,
        receivedAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to inject reply", detail: detail.slice(0, 200) },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, kind: parsed.data.kind });
}
