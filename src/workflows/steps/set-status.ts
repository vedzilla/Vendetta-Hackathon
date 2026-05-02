/**
 * Atomic status update. Wrapped as a step so the workflow trace shows
 * status transitions as discrete events.
 */

import { markStatus } from "@/lib/store";

import type { GrievanceStatus } from "@/types/grievance";

export async function setStatusStep(input: {
  grievanceId: string;
  status: GrievanceStatus;
}): Promise<void> {
  "use step";
  await markStatus(input.grievanceId, input.status);
}
