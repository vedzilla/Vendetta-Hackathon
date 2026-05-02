/**
 * Static multi-vertical campaigns for the dashboard backdrop. These NEVER
 * trigger workflows — they are KV records hand-written so the dashboard
 * looks alive and the platform claim is visually substantiated.
 *
 * Implementation in Block B (Terminal 1).
 */

import type { Grievance } from "@/types/grievance";

export async function loadSeededCampaigns(): Promise<Grievance[]> {
  throw new Error("not implemented: loadSeededCampaigns");
}

export async function ensureSeededCampaignsInKv(): Promise<void> {
  throw new Error("not implemented: ensureSeededCampaignsInKv");
}
