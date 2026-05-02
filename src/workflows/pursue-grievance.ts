/**
 * The single durable function that pursues a grievance from intake to
 * close-out. Everything else in the system orbits this. Steps are atomic
 * and live in ./steps/*; this file is the ordering and branching logic.
 *
 * Re-entry / recursion:
 *  - On `edit` approval, we recurse with the original input (the edits are
 *    persisted to the grievance facts before recursion so the redraft uses them).
 *  - On `REJECTION` reply or response timeout, we recurse with isEscalation=true.
 *  - The recursion is intentional: each recursion is a fresh workflow run, which
 *    keeps observability traces tractable instead of one ever-growing run.
 */

import { createHook, sleep } from "workflow";

import type { ApprovalAction, InboundReply } from "@/types/grievance";

import { applyEditsStep } from "./steps/apply-edits";
import { classifyAndExtractFacts } from "./steps/classify";
import { classifyReplyStep } from "./steps/classify-reply";
import { draftLetterStep } from "./steps/draft-letter";
import { escalateStep } from "./steps/escalate";
import { handleNegotiationStep } from "./steps/handle-negotiation";
import { loadGrievanceForWorkflow, loadMemoryForWorkflow } from "./steps/load";
import { postApprovalCardStep } from "./steps/post-approval-card";
import { reflectAndRecordStep } from "./steps/reflect-and-record";
import { researchTargetStep } from "./steps/research";
import { respondToInfoRequestStep } from "./steps/respond-to-info-request";
import { sendComplaintEmailStep } from "./steps/send-email";
import { setStatusStep } from "./steps/set-status";

import { demoSleep } from "@/lib/demo-sleep";

export interface PursueGrievanceInput {
  grievanceId: string;
  /** Time-warp factor — 1 in production, 12000 in the on-stage demo. */
  demoScale?: number;
  /** Set on recursive calls when the prior letter timed out or was rejected. */
  isEscalation?: boolean;
}

export async function pursueGrievance(input: PursueGrievanceInput): Promise<void> {
  "use workflow";

  const { grievanceId, demoScale = 1, isEscalation = false } = input;

  // 1. Load the grievance + recall lessons relevant to this campaign.
  const grievance = await loadGrievanceForWorkflow(grievanceId);
  const memory = await loadMemoryForWorkflow({
    grievanceId,
    category: grievance.category,
    company: grievance.facts.company,
  });

  // 2. Classify + extract facts (skipped on escalation re-entry — already known).
  if (!isEscalation) {
    await classifyAndExtractFacts(grievanceId);
  }

  // 3. Research the target via Bright Data MCP.
  const research = await researchTargetStep({ grievanceId });

  // 4. Draft the letter (Claude Opus + Mubit context).
  const draft = await draftLetterStep({
    grievanceId,
    research,
    memoryText: memory.text,
    memoryLessons: memory.lessons,
    isEscalation,
  });

  // 5. Human-in-the-loop approval. Workflow pauses with zero compute.
  await postApprovalCardStep({ grievanceId, draft });
  await setStatusStep({ grievanceId, status: "AWAITING_APPROVAL" });

  const approvalHook = createHook<ApprovalAction>({
    token: `approval:${grievanceId}`,
  });

  const approval = await Promise.race([
    approvalHook.then((value) => ({ kind: "decision" as const, value })),
    demoSleep("24h", demoScale).then(() => ({ kind: "timeout" as const })),
  ]);

  if (approval.kind === "timeout" || approval.value.action === "cancel") {
    await setStatusStep({ grievanceId, status: "CANCELLED" });
    await reflectAndRecordStep({ grievanceId, outcome: "CANCELLED" });
    return;
  }

  if (approval.value.action === "edit") {
    await applyEditsStep({ grievanceId, edits: approval.value.edits });
    await pursueGrievance(input);
    return;
  }

  // 6. Send + wait for reply (or escalation deadline).
  await sendComplaintEmailStep({
    grievanceId,
    research,
    draft,
  });
  await setStatusStep({ grievanceId, status: "AWAITING_REPLY" });

  const replyHook = createHook<InboundReply>({
    token: `reply:${grievanceId}`,
  });

  const replyDeadlineDays = research.typicalResponseDays ?? 14;
  const replyResult = await Promise.race([
    replyHook.then((value) => ({ kind: "reply" as const, value })),
    demoSleep(`${replyDeadlineDays} days`, demoScale).then(() => ({ kind: "timeout" as const })),
  ]);

  // 7. No reply within the deadline → escalate.
  if (replyResult.kind === "timeout") {
    await escalateStep({ grievanceId, reason: "deadline_lapsed", research });
    await pursueGrievance({ grievanceId, demoScale, isEscalation: true });
    return;
  }

  // 8. Branch on reply class.
  const classification = await classifyReplyStep({
    grievanceId,
    reply: replyResult.value,
    memoryText: memory.text,
    memoryLessons: memory.lessons,
  });

  switch (classification.kind) {
    case "ACCEPTANCE":
      await setStatusStep({ grievanceId, status: "WON" });
      break;

    case "PARTIAL_OFFER":
      await handleNegotiationStep({
        grievanceId,
        offerAmount: classification.offerAmount,
        memoryText: memory.text,
        memoryLessons: memory.lessons,
        demoScale,
      });
      break;

    case "REJECTION":
      await escalateStep({ grievanceId, reason: "rejection", research });
      await pursueGrievance({ grievanceId, demoScale, isEscalation: true });
      return;

    case "REQUEST_FOR_INFO":
      await respondToInfoRequestStep({ grievanceId, classification });
      // Re-arm a reply wait by recursing without isEscalation.
      // Brief settle so the API has time to record the response.
      await sleep("2s");
      await pursueGrievance({ grievanceId, demoScale, isEscalation: false });
      return;

    case "OTHER":
    default:
      // Treat unknown replies as a soft timeout — wait the rest of the deadline,
      // then escalate. For the hackathon we simply escalate immediately.
      await escalateStep({ grievanceId, reason: "unhandled_reply", research });
      await pursueGrievance({ grievanceId, demoScale, isEscalation: true });
      return;
  }

  // 9. Close out — extract durable lessons + record the outcome.
  await reflectAndRecordStep({
    grievanceId,
    outcome: classification.kind === "ACCEPTANCE" ? "WON" : "LOST",
  });
}
