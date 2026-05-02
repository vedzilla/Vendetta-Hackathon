/**
 * Persist user-supplied edits to the grievance so the next draft pass has
 * them in context. Edits land in `facts.userEdits` (a free-form string the
 * draft prompt is wired to read) and the timeline records the revision.
 */

import { remember } from "@/lib/mubit";
import { appendTimelineEvent, mergeFacts } from "@/lib/store";

export async function applyEditsStep(input: {
  grievanceId: string;
  edits: string;
}): Promise<void> {
  "use step";

  await mergeFacts(input.grievanceId, { userEdits: input.edits });

  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: "edited",
    summary: `User edits applied — redrafting`,
    payload: { edits: input.edits.slice(0, 400) },
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "decision",
    content: `User asked for edits before sending. Edits: ${input.edits}`,
  });
}
