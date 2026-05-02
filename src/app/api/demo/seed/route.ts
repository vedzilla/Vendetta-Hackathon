/**
 * POST /api/demo/seed — idempotently write the seeded multi-vertical
 * campaigns into KV so the dashboard has a populated backdrop.
 *
 * Safe to run repeatedly. The seeder uses upsertGrievance and skips index
 * writes for ids that already exist, so re-running this won't duplicate
 * counts or rewind timeline order.
 */

import { NextResponse } from "next/server";

import { ensureSeededCampaignsInKv, loadSeededCampaigns } from "@/lib/seeded-campaigns";

export async function POST() {
  await ensureSeededCampaignsInKv();
  const seeded = await loadSeededCampaigns();
  return NextResponse.json({
    ok: true,
    count: seeded.length,
    ids: seeded.map((g) => g.id),
  });
}
