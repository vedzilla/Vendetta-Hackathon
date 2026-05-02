/**
 * Next.js boot hook. Runs once per server process on cold start.
 *
 * We use it to seed the demo backdrop campaigns into KV so the dashboard
 * is never empty for a judge wandering past it. ensureSeededCampaignsInKv
 * is idempotent, so re-runs on subsequent cold starts are safe and cheap.
 *
 * Edge runtime cold starts cannot import @vercel/kv freely, so we gate to
 * the Node.js runtime only.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip seeding when KV is unavailable (e.g. local dev without KV configured).
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) {
    console.warn("[instrumentation] Vercel KV not configured — skipping demo seed");
    return;
  }

  try {
    const { ensureSeededCampaignsInKv } = await import("@/lib/seeded-campaigns");
    await ensureSeededCampaignsInKv();
  } catch (e) {
    console.warn("[instrumentation] demo seed failed:", e instanceof Error ? e.message : e);
  }
}
