/**
 * Classify an inbound reply (real or simulated). The Mubit lessons are
 * injected into the prompt so the LLM recognises known patterns
 * (e.g. "easyJet first response is always a £50 voucher").
 */

import { generateObject } from "ai";
import { z } from "zod";

import { reasoningModel } from "@/lib/ai";
import { remember, type MubitLesson } from "@/lib/mubit";
import { replyClassifierSystemPrompt } from "@/lib/prompts";
import { appendTimelineEvent } from "@/lib/store";

import type { ClassifiedReply, InboundReply } from "@/types/grievance";

const ReplyClassSchema = z.object({
  kind: z.enum([
    "ACCEPTANCE",
    "PARTIAL_OFFER",
    "REJECTION",
    "REQUEST_FOR_INFO",
    "OTHER",
  ]),
  offerAmount: z.number().optional(),
  summary: z.string().min(4),
});

export async function classifyReplyStep(input: {
  grievanceId: string;
  reply: InboundReply;
  memoryText: string;
  memoryLessons: MubitLesson[];
}): Promise<ClassifiedReply> {
  "use step";

  const { object } = await generateObject({
    model: reasoningModel,
    schema: ReplyClassSchema,
    system: replyClassifierSystemPrompt({
      text: input.memoryText,
      lessons: input.memoryLessons,
    }),
    prompt: [
      `From: ${input.reply.from}`,
      `Subject: ${input.reply.subject}`,
      "Body:",
      input.reply.body,
    ].join("\n"),
  });

  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: "reply_received",
    summary: `Reply classified as ${object.kind}: ${object.summary}`,
    payload: {
      kind: object.kind,
      offerAmount: object.offerAmount,
      from: input.reply.from,
      subject: input.reply.subject,
    },
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "decision",
    content: `Reply from ${input.reply.from} classified ${object.kind}${
      object.offerAmount ? ` (offer £${object.offerAmount})` : ""
    }: ${object.summary}`,
  });

  return object;
}
