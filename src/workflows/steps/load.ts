/**
 * Initial load steps — pull the grievance and the relevant Mubit memory
 * before any decision-making happens. Split into two steps so a Mubit
 * outage doesn't force a re-fetch of the grievance from KV.
 */

import { getMemoryContext, type MubitLesson } from "@/lib/mubit";
import { loadGrievance } from "@/lib/store";

import type { Grievance, GrievanceCategory } from "@/types/grievance";

export async function loadGrievanceForWorkflow(grievanceId: string): Promise<Grievance> {
  "use step";
  return loadGrievance(grievanceId);
}

export async function loadMemoryForWorkflow(input: {
  grievanceId: string;
  category: GrievanceCategory;
  company?: string;
}): Promise<{ text: string; lessons: MubitLesson[] }> {
  "use step";
  const query = input.company
    ? `Pursuing ${input.category} grievance against ${input.company}`
    : `Pursuing ${input.category} grievance`;
  return getMemoryContext({
    grievanceId: input.grievanceId,
    query,
    category: input.category,
  });
}
