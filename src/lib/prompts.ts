/**
 * System prompt + template builders. Centralised so we can rev wording
 * without touching workflow files.
 *
 * Implementation in Block A→B (Terminal 1).
 */

import type { Grievance, GrievanceResearch } from "@/types/grievance";
import type { MemoryContext } from "./mubit";

export function classifierSystemPrompt(): string {
  throw new Error("not implemented: classifierSystemPrompt");
}

export function factExtractionSystemPrompt(): string {
  throw new Error("not implemented: factExtractionSystemPrompt");
}

export function researchSystemPrompt(_grievance: Grievance): string {
  throw new Error("not implemented: researchSystemPrompt");
}

export function draftLetterSystemPrompt(_input: {
  grievance: Grievance;
  research: GrievanceResearch;
  memory: MemoryContext;
  isEscalation: boolean;
}): string {
  throw new Error("not implemented: draftLetterSystemPrompt");
}

export function replyClassifierSystemPrompt(_memory: MemoryContext): string {
  throw new Error("not implemented: replyClassifierSystemPrompt");
}
