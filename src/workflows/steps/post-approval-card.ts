/**
 * Post the human-in-the-loop approval card to the user's Telegram chat.
 *
 * The card carries the draft subject + first ~600 chars of body and three
 * inline-keyboard buttons (Approve / Edit / Cancel). The buttons hit
 * `/api/grievances/:id/approve`, which calls `resumeHook("approval:{id}", ...)`.
 *
 * If the user has no Telegram channel configured we still log a timeline
 * event — the dashboard renders an in-page approval card from KV alone.
 */

import type { DraftLetter } from "./draft-letter";

import { remember } from "@/lib/mubit";
import { appendTimelineEvent, loadGrievance } from "@/lib/store";

const TELEGRAM_API = "https://api.telegram.org";

async function postToTelegram(chatId: string, text: string, grievanceId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    // Soft-fail — the dashboard is the fallback approval surface.
    console.warn("[approval] TELEGRAM_BOT_TOKEN not set; skipping Telegram post");
    return;
  }
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve:${grievanceId}` },
            { text: "✏️ Edit", callback_data: `edit:${grievanceId}` },
            { text: "✖ Cancel", callback_data: `cancel:${grievanceId}` },
          ],
        ],
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

export async function postApprovalCardStep(input: {
  grievanceId: string;
  draft: DraftLetter;
}): Promise<void> {
  "use step";

  const grievance = await loadGrievance(input.grievanceId);
  const chatId = grievance.notifyVia.telegram?.chatId;

  const preview = input.draft.body.length > 600
    ? `${input.draft.body.slice(0, 600).trim()}…`
    : input.draft.body;

  if (chatId && chatId !== "demo") {
    const text = [
      `*Draft ready for ${grievance.facts.company ?? "your grievance"}*`,
      "",
      `*Subject:* ${input.draft.subject}`,
      "",
      "```",
      preview,
      "```",
      "",
      "Tap *Approve* to send, *Edit* to revise, or *Cancel* to drop.",
    ].join("\n");
    await postToTelegram(chatId, text, input.grievanceId);
  }

  await appendTimelineEvent(input.grievanceId, {
    at: new Date().toISOString(),
    kind: "approval_requested",
    summary: `Approval card sent — awaiting user decision`,
    payload: { subject: input.draft.subject, preview },
  });

  await remember({
    grievanceId: input.grievanceId,
    kind: "decision",
    content: `Approval card posted: "${input.draft.subject}".`,
  });
}
