/**
 * POST /api/grievances — intake.
 *
 * Validates input, creates the KV record, kicks off pursueGrievance, and
 * persists the workflow run id back to the grievance for deep-linking to
 * the Vercel observability dashboard.
 *
 * GET /api/grievances — list (query: ?userId=...).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { start } from "workflow/api";

import { createGrievance, listGrievances, setWorkflowRunIds } from "@/lib/store";
import { pursueGrievance } from "@/workflows/pursue-grievance";
import { simulateReplies } from "@/workflows/simulate-replies";

const NotifyViaSchema = z.object({
  telegram: z.object({ chatId: z.string() }).optional(),
  email: z.string().email().optional(),
}).refine(
  (v) => v.telegram || v.email,
  { message: "Provide at least one notify channel (telegram.chatId or email)" },
);

const FactsSchema = z
  .object({
    company: z.string().optional(),
    incidentDate: z.string().optional(),
    referenceNumber: z.string().optional(),
    amountClaimed: z.number().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const CreateBodySchema = z.object({
  description: z.string().min(8),
  notifyVia: NotifyViaSchema,
  facts: FactsSchema.optional(),
  category: z
    .enum(["UK_FLIGHT_DELAY", "PARKING_FINE", "SUBSCRIPTION_CANCELLATION", "TRAIN_DELAY"])
    .optional(),
  metadata: z
    .object({
      demoMode: z.boolean().optional(),
      scenario: z.enum(["easy_win", "negotiation", "escalation"]).optional(),
      seeded: z.boolean().optional(),
    })
    .optional(),
  /** Optional time-warp scale for non-demo paths (e.g. weekend soak runs). */
  demoScale: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const grievance = await createGrievance({
    description: parsed.data.description,
    notifyVia: parsed.data.notifyVia,
    facts: parsed.data.facts,
    category: parsed.data.category,
    metadata: parsed.data.metadata,
  });

  // Only the live vertical actually starts a workflow. Seeded fakes never do.
  const startsLive =
    grievance.category === "UK_FLIGHT_DELAY" && !grievance.metadata?.seeded;

  // Demo path: scenarios run end-to-end with scaled sleeps and a synthetic
  // airline reply, so a Telegram-driven flight grievance can complete in
  // under 2 minutes on stage.
  const demoMode = grievance.metadata?.demoMode === true;
  const demoScale = parsed.data.demoScale ?? (demoMode ? 12_000 : 1);
  const scenario = grievance.metadata?.scenario ?? "easy_win";

  let workflowRunId: string | undefined;
  let simulationRunId: string | undefined;
  if (startsLive) {
    const run = await start(pursueGrievance, [
      { grievanceId: grievance.id, demoScale },
    ]);
    workflowRunId = run.runId;

    if (demoMode) {
      const simRun = await start(simulateReplies, [
        {
          grievanceId: grievance.id,
          scenario,
          demoScale,
          autoApprove: true,
        },
      ]);
      simulationRunId = simRun.runId;
    }

    await setWorkflowRunIds(grievance.id, { workflowRunId, simulationRunId });
  }

  return NextResponse.json(
    {
      grievanceId: grievance.id,
      workflowRunId,
      simulationRunId,
      status: grievance.status,
      category: grievance.category,
    },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId") ?? undefined;
  const grievances = await listGrievances(userId);
  return NextResponse.json({ grievances });
}
