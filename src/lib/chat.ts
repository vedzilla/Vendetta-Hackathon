/**
 * ChatSDK — Telegram bot wiring. The same agent class will accept a Slack
 * adapter in stretch-goal land.
 *
 * Implementation in Block A→B (Terminal 1, glue) + Terminal 2 (handlers).
 */

import type { Grievance } from "@/types/grievance";

export interface ApprovalCardPayload {
  grievanceId: string;
  draftSubject: string;
  draftBody: string;
}

export async function postApprovalCardToTelegram(
  _grievance: Grievance,
  _payload: ApprovalCardPayload
): Promise<void> {
  throw new Error("not implemented: postApprovalCardToTelegram");
}

export async function notifyTelegram(_chatId: string, _message: string): Promise<void> {
  throw new Error("not implemented: notifyTelegram");
}
