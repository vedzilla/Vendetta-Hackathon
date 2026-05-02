/**
 * POST /api/grievances/:id/approve — human-in-the-loop resume.
 *
 * Resolves the `approval:{grievanceId}` hook the workflow is awaiting.
 * Used by:
 *  - Dashboard inline approval card.
 *  - Telegram callback button handler (which proxies through here).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { resumeHook } from "workflow/api";

import { appendTimelineEvent } from "@/lib/store";

import type { ApprovalAction } from "@/types/grievance";

const ApprovalSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("edit"), edits: z.string().min(1) }),
  z.object({ action: z.literal("cancel") }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const action: ApprovalAction = parsed.data;

  try {
    await resumeHook(`approval:${id}`, action);
  } catch (e) {
    return NextResponse.json(
      {
        error: "No paused workflow awaiting approval for this grievance",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 404 },
    );
  }

  await appendTimelineEvent(id, {
    at: new Date().toISOString(),
    kind: action.action === "approve"
      ? "approved"
      : action.action === "edit"
        ? "edited"
        : "cancelled",
    summary: action.action === "edit"
      ? `User requested edits — redrafting`
      : action.action === "approve"
        ? `User approved — sending`
        : `User cancelled the campaign`,
    payload: action.action === "edit" ? { edits: action.edits.slice(0, 400) } : undefined,
  });

  return NextResponse.json({ ok: true, action: action.action });
}
