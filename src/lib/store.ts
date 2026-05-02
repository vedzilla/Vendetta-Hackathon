/**
 * KV-backed grievance store. Single source of user-visible state.
 *
 * The workflow's persisted execution state is authoritative for compute;
 * this mirror exists so the dashboard can read campaigns and timelines
 * without going through workflow internals.
 *
 * Keys:
 *   grievance:{id}             JSON Grievance document
 *   grievance:{id}:timeline    LIST of TimelineEvent JSON entries (LPUSH = newest first)
 *   grievances:index           SET of all grievance ids
 *   grievances:user:{userId}   SET of grievance ids for that user
 */

import { kv } from "@vercel/kv";

import type {
  CreateGrievanceInput,
  Grievance,
  GrievanceResearch,
  GrievanceStatus,
  TimelineEvent,
} from "@/types/grievance";

const grievanceKey = (id: string) => `grievance:${id}`;
const timelineKey = (id: string) => `grievance:${id}:timeline`;
const INDEX_KEY = "grievances:index";
const userIndexKey = (userId: string) => `grievances:user:${userId}`;

function newGrievanceId(): string {
  // 12-char base36 — collision-free for hackathon volumes, short in URLs.
  return `g_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}

/**
 * Hydrate a Grievance from KV. Timeline list is read separately and
 * ordered oldest-first for display.
 */
async function hydrate(id: string): Promise<Grievance | null> {
  const doc = await kv.get<Grievance>(grievanceKey(id));
  if (!doc) return null;

  const rawTimeline = await kv.lrange<TimelineEvent>(timelineKey(id), 0, -1);
  // LPUSH'd events come back newest-first; flip to chronological for callers.
  const timeline = [...rawTimeline].reverse();
  return { ...doc, timeline };
}

export async function createGrievance(input: CreateGrievanceInput): Promise<Grievance> {
  const id = newGrievanceId();
  const now = new Date().toISOString();
  const userId = input.notifyVia.telegram?.chatId
    ?? input.notifyVia.email
    ?? "anonymous";

  const initialEvent: TimelineEvent = {
    at: now,
    kind: "received",
    summary: "Grievance received",
  };

  const grievance: Grievance = {
    id,
    userId,
    category: input.category ?? "UK_FLIGHT_DELAY",
    status: "INTAKE",
    rawDescription: input.description,
    facts: input.facts ?? {},
    timeline: [initialEvent],
    notifyVia: input.notifyVia,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };

  await Promise.all([
    kv.set(grievanceKey(id), grievance),
    kv.lpush(timelineKey(id), initialEvent),
    kv.sadd(INDEX_KEY, id),
    kv.sadd(userIndexKey(userId), id),
  ]);

  return grievance;
}

export async function loadGrievance(id: string): Promise<Grievance> {
  const grievance = await hydrate(id);
  if (!grievance) {
    throw new Error(`Grievance ${id} not found`);
  }
  return grievance;
}

export async function listGrievances(userId?: string): Promise<Grievance[]> {
  const ids = userId
    ? await kv.smembers(userIndexKey(userId))
    : await kv.smembers(INDEX_KEY);

  if (!ids || ids.length === 0) return [];

  const docs = await Promise.all(ids.map((id) => hydrate(id)));
  return docs
    .filter((g): g is Grievance => g !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendTimelineEvent(
  grievanceId: string,
  event: TimelineEvent,
): Promise<void> {
  await kv.lpush(timelineKey(grievanceId), event);
  await kv.set(grievanceKey(grievanceId), {
    ...(await kv.get<Grievance>(grievanceKey(grievanceId))),
    updatedAt: event.at,
  });
}

/**
 * Patch a subset of grievance fields and bump updatedAt.
 * Internal helper — public callers go through the typed setters below.
 */
async function patch(grievanceId: string, fields: Partial<Grievance>): Promise<void> {
  const existing = await kv.get<Grievance>(grievanceKey(grievanceId));
  if (!existing) {
    throw new Error(`Grievance ${grievanceId} not found`);
  }
  const updated: Grievance = {
    ...existing,
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(grievanceKey(grievanceId), updated);
}

export async function markStatus(
  grievanceId: string,
  status: GrievanceStatus,
): Promise<void> {
  await patch(grievanceId, { status });
}

export async function saveResearch(
  grievanceId: string,
  research: GrievanceResearch,
): Promise<void> {
  await patch(grievanceId, { research });
}

export async function setWorkflowRunIds(
  grievanceId: string,
  ids: { workflowRunId?: string; simulationRunId?: string },
): Promise<void> {
  const fields: Partial<Grievance> = {};
  if (ids.workflowRunId !== undefined) fields.workflowRunId = ids.workflowRunId;
  if (ids.simulationRunId !== undefined) fields.simulationRunId = ids.simulationRunId;
  await patch(grievanceId, fields);
}

/**
 * Merge new facts into an existing grievance. Used by the classification step.
 */
export async function mergeFacts(
  grievanceId: string,
  facts: Grievance["facts"],
): Promise<void> {
  const existing = await kv.get<Grievance>(grievanceKey(grievanceId));
  if (!existing) {
    throw new Error(`Grievance ${grievanceId} not found`);
  }
  await patch(grievanceId, { facts: { ...existing.facts, ...facts } });
}

/**
 * Idempotent upsert — used by the seed-on-boot script and the demo seeder.
 *
 * INDEX_KEY/userIndexKey writes are unconditional: SADD is naturally idempotent
 * and we want to self-heal indexes if a previous run wrote the doc but skipped
 * the index (e.g. an earlier instrumentation race or a partial failure).
 *
 * The timeline LPUSH is guarded by isNew so re-running this never duplicates
 * timeline events.
 */
export async function upsertGrievance(grievance: Grievance): Promise<void> {
  const isNew = !(await kv.exists(grievanceKey(grievance.id)));
  await kv.set(grievanceKey(grievance.id), grievance);
  await Promise.all([
    kv.sadd(INDEX_KEY, grievance.id),
    kv.sadd(userIndexKey(grievance.userId), grievance.id),
  ]);
  if (isNew) {
    await Promise.all(
      grievance.timeline.map((e) => kv.lpush(timelineKey(grievance.id), e)),
    );
  }
}
