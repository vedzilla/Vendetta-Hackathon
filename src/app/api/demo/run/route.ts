/**
 * POST /api/demo/run — start a scripted demo scenario.
 *
 * Body: { scenario: "easy_win" | "negotiation" | "escalation" }
 *
 * Spawns two parallel workflows: pursueGrievance + simulateReplies. Both
 * are real durable runs; only the email *bodies* are scripted. demoScale
 * defaults to 12_000 (14 days collapse to ~100s on stage).
 *
 * Gated by ENABLE_DEMO_MODE — production deployments without that flag
 * return 404 to keep the panel hidden.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { start } from "workflow/api";

import { getScenario, type ScenarioKey } from "@/lib/demo-scenarios";
import { createGrievance, setWorkflowRunIds } from "@/lib/store";
import { pursueGrievance } from "@/workflows/pursue-grievance";
import { simulateReplies } from "@/workflows/simulate-replies";

const BodySchema = z.object({
  scenario: z.enum(["easy_win", "negotiation", "escalation"]),
  demoScale: z.number().int().positive().optional(),
});

const DEFAULT_DEMO_SCALE = 12_000;

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

  const scenario: ScenarioKey = parsed.data.scenario;
  const script = getScenario(scenario);
  const demoScale = parsed.data.demoScale ?? DEFAULT_DEMO_SCALE;

  const grievance = await createGrievance({
    description: script.voiceNoteText,
    facts: script.preExtractedFacts,
    notifyVia: {
      telegram: { chatId: process.env.DEMO_TELEGRAM_CHAT_ID ?? "demo" },
    },
    category: "UK_FLIGHT_DELAY",
    metadata: { demoMode: true, scenario },
  });

  // Start both workflows in parallel — pursue + replies.
  const [campaignRun, simRun] = await Promise.all([
    start(pursueGrievance, [{ grievanceId: grievance.id, demoScale }]),
    start(simulateReplies, [{ grievanceId: grievance.id, scenario, demoScale }]),
  ]);

  await setWorkflowRunIds(grievance.id, {
    workflowRunId: campaignRun.runId,
    simulationRunId: simRun.runId,
  });

  return NextResponse.json(
    {
      grievanceId: grievance.id,
      campaignRunId: campaignRun.runId,
      simRunId: simRun.runId,
      scenario,
      demoScale,
      estimatedSeconds: script.estimatedSeconds,
    },
    { status: 202 },
  );
}
