/**
 * Draft the complaint letter using Claude Opus + injected Mubit lessons.
 * Returns a structured { subject, body } that downstream steps consume
 * unchanged.
 */

import { generateObject } from "ai";
import { z } from "zod";

import { reasoningModel } from "@/lib/ai";
import { remember, type MubitLesson } from "@/lib/mubit";
import { draftLetterSystemPrompt } from "@/lib/prompts";
import { appendTimelineEvent, loadGrievance } from "@/lib/store";

import type { GrievanceResearch } from "@/types/grievance";

const DraftSchema = z.object({
  subject: z.string().min(8),
  body: z.string().min(80),
});

export interface DraftLetter {
  subject: string;
  body: string;
}

export async function draftLetterStep(input: {
  grievanceId: string;
  research: GrievanceResearch;
  memoryText: string;
  memoryLessons: MubitLesson[];
  isEscalation: boolean;
}): Promise<DraftLetter> {
  "use step";

  const grievance = await loadGrievance(input.grievanceId);

  const { object } = await generateObject({
    model: reasoningModel,
    schema: DraftSchema,
    system: draftLetterSystemPrompt({
      grievance,
      research: input.research,
      memory: { text: input.memoryText, lessons: input.memoryLessons },
      isEscalation: input.isEscalation,
    }),
    prompt: [
      `Grievance description: "${grievance.rawDescription}"`,
      `Known facts: ${JSON.stringify(grievance.facts)}`,
      input.research.complaintsAddress
        ? `Send to: ${input.research.complaintsAddress}`
        : "No complaints address yet — keep recipient generic.",
    ].join("\n"),
  });

  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: "drafted",
    summary: input.isEscalation
      ? `Drafted escalation letter — "${object.subject}"`
      : `Drafted complaint letter — "${object.subject}"`,
    payload: { subject: object.subject, isEscalation: input.isEscalation },
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "decision",
    content: `${input.isEscalation ? "Escalation" : "First"} letter drafted, subject: "${object.subject}".`,
  });

  return object;
}
