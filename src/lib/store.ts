/**
 * KV-backed grievance store. Single source of user-visible state.
 * The workflow's persisted execution state is authoritative for compute;
 * this mirror is for the dashboard.
 *
 * Implementation in Block A→B (Terminal 1).
 */

import type {
  CreateGrievanceInput,
  Grievance,
  GrievanceResearch,
  GrievanceStatus,
  TimelineEvent,
} from "@/types/grievance";

export async function createGrievance(_input: CreateGrievanceInput): Promise<Grievance> {
  throw new Error("not implemented: createGrievance");
}

export async function loadGrievance(_id: string): Promise<Grievance> {
  throw new Error("not implemented: loadGrievance");
}

export async function listGrievances(_userId?: string): Promise<Grievance[]> {
  throw new Error("not implemented: listGrievances");
}

export async function appendTimelineEvent(
  _grievanceId: string,
  _event: TimelineEvent
): Promise<void> {
  throw new Error("not implemented: appendTimelineEvent");
}

export async function markStatus(
  _grievanceId: string,
  _status: GrievanceStatus
): Promise<void> {
  throw new Error("not implemented: markStatus");
}

export async function saveResearch(
  _grievanceId: string,
  _research: GrievanceResearch
): Promise<void> {
  throw new Error("not implemented: saveResearch");
}

export async function setWorkflowRunIds(
  _grievanceId: string,
  _ids: { workflowRunId?: string; simulationRunId?: string }
): Promise<void> {
  throw new Error("not implemented: setWorkflowRunIds");
}
