/**
 * System prompts. Centralised so wording revs don't touch workflow files.
 *
 * Style rules:
 *  - Stay under ~800 tokens per prompt (Mubit context is injected separately).
 *  - Speak in second-person imperative ("Extract...", "Draft..."), not third.
 *  - Where the LLM should produce structured output, ask for JSON only.
 *  - Lessons from Mubit are appended verbatim — never paraphrase them inline.
 */

import type { Grievance, GrievanceResearch } from "@/types/grievance";
import { verticalFor } from "@/types/verticals";

import type { MemoryContext } from "./mubit";

function memoryBlock(memory: MemoryContext): string {
  if (!memory.text && memory.lessons.length === 0) {
    return "(no prior lessons yet — first campaign in this lane)";
  }
  const lessons = memory.lessons
    .map((l, i) => `  ${i + 1}. ${l.text}  (strength=${l.strength.toFixed(2)})`)
    .join("\n");
  const blocks: string[] = [];
  if (memory.text) blocks.push(memory.text.trim());
  if (lessons) blocks.push(`Top surfaced lessons:\n${lessons}`);
  return blocks.join("\n\n");
}

export function classifierSystemPrompt(): string {
  return [
    "You classify a user-submitted grievance into one of four categories:",
    "  - UK_FLIGHT_DELAY (UK or EU flight delays / cancellations under EC 261/2004 or UK261)",
    "  - PARKING_FINE (private parking notices / council PCNs)",
    "  - SUBSCRIPTION_CANCELLATION (subscription disputes, refused cancellations)",
    "  - TRAIN_DELAY (UK rail Delay Repay claims)",
    "",
    "Return strict JSON: { category, company, confidence }. company may be null.",
    "If the grievance does not clearly fit any category, pick the closest and",
    "set confidence < 0.5.",
  ].join("\n");
}

export function factExtractionSystemPrompt(): string {
  return [
    "Extract structured facts from the user's grievance description. Return",
    "strict JSON; omit any field you are not confident about. Never hallucinate",
    "dates, flight numbers, amounts, or reference codes — leave them undefined",
    "instead.",
    "",
    "Useful general fields: company, incidentDate (ISO date), referenceNumber,",
    "amountClaimed, currency.",
    "",
    "For UK_FLIGHT_DELAY also extract: flightNumber, origin, destination,",
    "scheduledDeparture, actualArrival, delayHours, distanceKm,",
    "airlineCitedExtraordinary (boolean).",
  ].join("\n");
}

export function researchSystemPrompt(grievance: Grievance): string {
  const v = verticalFor(grievance.category);
  return [
    `You are a research agent investigating a ${v.label} grievance against`,
    `${grievance.facts.company ?? "an unknown company"}.`,
    "",
    "Your goal is to find FOUR things and return them as strict JSON:",
    "  1. complaintsAddress — the company's official complaints email address.",
    "  2. regulatorName + regulatorUrl — the relevant UK or EU regulator and",
    "     where consumer claims are filed.",
    "  3. relevantStatutes — the exact statute/article citations to anchor on.",
    `     For ${v.label} the canonical anchors include: ${v.primaryStatutes.slice(0, 3).join("; ")}.`,
    "  4. executiveContact (optional) — name, role, and LinkedIn URL of the",
    "     customer-experience director or equivalent, for escalation copy.",
    "",
    "Tools available: Bright Data MCP. Prefer search_engine for discovery,",
    "scrape_as_markdown for policy pages, and web_data_linkedin_person_profile",
    "for executives. Stream a one-line status update before each major action.",
  ].join("\n");
}

export function draftLetterSystemPrompt(input: {
  grievance: Grievance;
  research: GrievanceResearch;
  memory: MemoryContext;
  isEscalation: boolean;
}): string {
  const { grievance, research, memory, isEscalation } = input;
  const v = verticalFor(grievance.category);
  const stage = isEscalation ? "ESCALATION letter" : "FIRST complaint letter";

  return [
    `Draft a ${stage} for a ${v.label} grievance against`,
    `${grievance.facts.company ?? "the company"}.`,
    "",
    "Tone: firm, professional, factual. UK English. No threats, no emotion,",
    "no exclamation marks. Address known facts only — if a fact is missing,",
    "phrase the request to elicit it rather than inventing one.",
    "",
    isEscalation
      ? "Escalation letters: open by referencing the prior unaddressed complaint and the elapsed time. Cite the regulator and signal intent to file a formal complaint if no resolution is forthcoming."
      : "First letters: open with the incident, cite the lead statute in the first paragraph, state the exact compensation entitlement, and request payment within 14 days to a named account.",
    "",
    `Anchor statutes available: ${v.primaryStatutes.join("; ")}.`,
    research.regulatorName ? `Regulator on file: ${research.regulatorName}.` : "",
    research.complaintsAddress ? `Complaints address on file: ${research.complaintsAddress}.` : "",
    "",
    "PRIOR LESSONS FROM SIMILAR CAMPAIGNS:",
    memoryBlock(memory),
    "",
    "Return strict JSON: { subject, body }. body is plain text with paragraph",
    "breaks; no markdown, no signatures (the system appends those).",
  ]
    .filter(Boolean)
    .join("\n");
}

export function replyClassifierSystemPrompt(memory: MemoryContext): string {
  return [
    "Classify an inbound reply from the company into one of:",
    "  - ACCEPTANCE       (full payment / full remedy agreed)",
    "  - PARTIAL_OFFER    (a smaller cash sum or a voucher offered)",
    "  - REJECTION        (claim refused outright, often citing extraordinary circumstances)",
    "  - REQUEST_FOR_INFO (asking for boarding pass, booking ref, etc.)",
    "  - OTHER            (anything else — auto-acknowledgement, etc.)",
    "",
    "Return strict JSON: { kind, offerAmount, summary }.",
    "  - offerAmount: numeric cash amount in the grievance currency, if any.",
    "  - summary: one sentence for the dashboard timeline.",
    "",
    "PRIOR LESSONS RELEVANT TO REPLY HANDLING:",
    memoryBlock(memory),
  ].join("\n");
}
