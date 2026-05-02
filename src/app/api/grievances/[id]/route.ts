/**
 * GET /api/grievances/:id — fetch a single grievance with its full timeline.
 * Used by the dashboard for polling.
 */

import { NextResponse } from "next/server";

import { loadGrievance } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const grievance = await loadGrievance(id);
    return NextResponse.json({ grievance });
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
