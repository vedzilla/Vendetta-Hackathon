/**
 * Classify the grievance into a vertical and extract structured facts in
 * one step. We do them together so the LLM has the description in context
 * for both — and one step boundary instead of two keeps the workflow trace
 * legible.
 */

import { generateObject } from "ai";
import { z } from "zod";

import { fastModel } from "@/lib/ai";
import { remember } from "@/lib/mubit";
import { classifierSystemPrompt, factExtractionSystemPrompt } from "@/lib/prompts";
import { appendTimelineEvent, loadGrievance, mergeFacts, markStatus } from "@/lib/store";

const ClassificationSchema = z.object({
  category: z.enum([
    "UK_FLIGHT_DELAY",
    "PARKING_FINE",
    "SUBSCRIPTION_CANCELLATION",
    "TRAIN_DELAY",
  ]),
  company: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const FactsSchema = z.object({
  company: z.string().optional(),
  incidentDate: z.string().optional(),
  referenceNumber: z.string().optional(),
  amountClaimed: z.number().optional(),
  currency: z.string().optional(),
  flightNumber: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  scheduledDeparture: z.string().optional(),
  actualArrival: z.string().optional(),
  delayHours: z.number().optional(),
  distanceKm: z.number().optional(),
  airlineCitedExtraordinary: z.boolean().optional(),
});

export async function classifyAndExtractFacts(grievanceId: string): Promise<void> {
  "use step";

  const grievance = await loadGrievance(grievanceId);

  const { object: classification } = await generateObject({
    model: fastModel,
    schema: ClassificationSchema,
    system: classifierSystemPrompt(),
    prompt: grievance.rawDescription,
  });

  const { object: facts } = await generateObject({
    model: fastModel,
    schema: FactsSchema,
    system: factExtractionSystemPrompt(),
    prompt: grievance.rawDescription,
  });

  const company = facts.company ?? classification.company ?? grievance.facts.company;
  const merged = { ...facts, company };
  // Strip undefined keys so we don't overwrite existing facts with null.
  const cleaned = Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined),
  );

  await mergeFacts(grievanceId, cleaned);
  await markStatus(grievanceId, "CLASSIFIED");
  await appendTimelineEvent(grievanceId, {
    at: new Date().toISOString(),
    kind: "classified",
    summary: `Classified as ${classification.category}${company ? ` — ${company}` : ""}`,
    payload: { confidence: classification.confidence, facts: cleaned },
  });

  await remember({
    grievanceId,
    kind: "fact",
    content: `Grievance classified as ${classification.category} against ${company ?? "(unknown)"}.`,
    metadata: { vertical: classification.category, ...cleaned },
  });
}
