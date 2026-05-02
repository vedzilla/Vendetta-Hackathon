/**
 * Research the target. Uses a DurableAgent loop with Bright Data MCP tools
 * so the LLM can search, scrape, and chase LinkedIn profiles autonomously.
 *
 * The agent loop is itself a step under the hood — failed tool calls retry,
 * completed ones never re-run, and the whole thing survives a deploy.
 */

import { DurableAgent } from "@workflow/ai/agent";

import { reasoningModel } from "@/lib/ai";
import { getBrightDataTools } from "@/lib/brightdata";
import { remember } from "@/lib/mubit";
import { researchSystemPrompt } from "@/lib/prompts";
import {
  appendTimelineEvent,
  loadGrievance,
  markStatus,
  saveResearch,
} from "@/lib/store";
import { verticalFor } from "@/types/verticals";

import type { GrievanceResearch } from "@/types/grievance";

const RESEARCH_JSON_GUIDE = `
Return your final assistant message as a single JSON object on its own line:
{
  "complaintsAddress": "...",
  "regulatorName": "...",
  "regulatorUrl": "...",
  "relevantStatutes": ["..."],
  "executiveContact": { "name": "...", "role": "...", "linkedinUrl": "..." },
  "typicalResponseDays": 14
}
Omit any field you couldn't determine. Do not wrap in code fences.`;

function extractJson(text: string): unknown {
  // Tolerate code-fenced output even though we asked for raw JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  // Find the first balanced { ... } block.
  const start = candidate.indexOf("{");
  if (start < 0) throw new Error("research: no JSON object in agent output");
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === "{") depth++;
    else if (candidate[i] === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1));
      }
    }
  }
  throw new Error("research: unbalanced JSON in agent output");
}

export async function researchTargetStep(input: {
  grievanceId: string;
}): Promise<GrievanceResearch> {
  "use step";

  const grievance = await loadGrievance(input.grievanceId);
  await markStatus(input.grievanceId, "RESEARCHING");

  const tools = await getBrightDataTools();

  const agent = new DurableAgent({
    model: reasoningModel,
    instructions: `${researchSystemPrompt(grievance)}\n\n${RESEARCH_JSON_GUIDE}`,
    tools,
  });

  const result = await agent.generate({
    messages: [
      {
        role: "user",
        content: `Grievance description: "${grievance.rawDescription}"\nKnown facts: ${JSON.stringify(grievance.facts)}`,
      },
    ],
  });

  const lastMessage = result.messages[result.messages.length - 1];
  const textContent = Array.isArray(lastMessage.content)
    ? lastMessage.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
    : String(lastMessage.content ?? "");

  let parsed: Partial<GrievanceResearch>;
  try {
    parsed = extractJson(textContent) as Partial<GrievanceResearch>;
  } catch {
    // Fall back to vertical defaults so the workflow can still proceed.
    const v = verticalFor(grievance.category);
    parsed = {
      regulatorName: v.regulator,
      regulatorUrl: v.regulatorUrl,
      relevantStatutes: v.primaryStatutes,
      typicalResponseDays: v.defaultDeadlineDays,
    };
  }

  const v = verticalFor(grievance.category);
  const research: GrievanceResearch = {
    complaintsAddress: parsed.complaintsAddress,
    regulatorName: parsed.regulatorName ?? v.regulator,
    regulatorUrl: parsed.regulatorUrl ?? v.regulatorUrl,
    relevantStatutes: parsed.relevantStatutes ?? v.primaryStatutes,
    executiveContact: parsed.executiveContact,
    typicalResponseDays: parsed.typicalResponseDays ?? v.defaultDeadlineDays,
  };

  await saveResearch(input.grievanceId, research);
  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: "researched",
    summary: research.complaintsAddress
      ? `Found complaints address ${research.complaintsAddress}; regulator: ${research.regulatorName}`
      : `Identified regulator ${research.regulatorName}; awaiting complaints address`,
    payload: research as unknown as Record<string, unknown>,
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "fact",
    content: `Research complete: complaints=${research.complaintsAddress ?? "(unknown)"}, regulator=${research.regulatorName ?? "(unknown)"}, statutes=${(research.relevantStatutes ?? []).join("; ")}`,
  });

  return research;
}
