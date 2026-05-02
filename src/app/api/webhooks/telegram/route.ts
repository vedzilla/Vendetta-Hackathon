import { NextResponse } from "next/server";
import { z } from "zod";

const messageSchema = z.object({
  message_id: z.number(),
  text: z.string().optional(),
  voice: z.object({ file_id: z.string() }).optional(),
  chat: z.object({ id: z.union([z.string(), z.number()]) }),
});

const callbackQuerySchema = z.object({
  id: z.string(),
  data: z.string(),
  message: z
    .object({
      chat: z.object({ id: z.union([z.string(), z.number()]) }),
    })
    .optional(),
});

const telegramUpdateSchema = z.object({
  message: messageSchema.optional(),
  callback_query: callbackQuerySchema.optional(),
});

type TelegramMessage = z.infer<typeof messageSchema>;

const token = process.env.TELEGRAM_BOT_TOKEN;

async function telegram(method: string, body: Record<string, unknown>) {
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postMessage(chatId: string, text: string, replyMarkup?: Record<string, unknown>) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  });
}

function isFollowUp(text: string) {
  return /\b(how|status|update|progress|case)\b/i.test(text);
}

// Companies that come up most often — a tiny pre-classifier so the dashboard
// shows a real name within a second of the user hitting send, before the LLM
// classification step has had time to run. The workflow's classifier will
// still write the authoritative company name on top of this.
const KNOWN_COMPANIES = [
  "Wizz Air",
  "easyJet",
  "Ryanair",
  "British Airways",
  "Jet2",
  "TUI",
  "Avanti West Coast",
  "ParkingEye",
  "Euro Car Parks",
  "PureGym",
  "StreamBox",
  "Netflix",
  "Spotify",
];

function guessCompany(description: string): string | undefined {
  const haystack = description.toLowerCase();
  for (const name of KNOWN_COMPANIES) {
    if (haystack.includes(name.toLowerCase())) return name;
  }
  // Loose phonetic catch — "wiz air" / "wizair" → "Wizz Air".
  if (/\bwi(z|zz)\s*air\b/i.test(description)) return "Wizz Air";
  if (/\beasy\s*jet\b/i.test(description)) return "easyJet";
  if (/\brye\s*air\b/i.test(description)) return "Ryanair";
  return undefined;
}

function pickScenario(description: string): "easy_win" | "negotiation" | "escalation" {
  const t = description.toLowerCase();
  if (/extraordinary|atc|notam|ryanair|weather|refus/.test(t)) return "escalation";
  if (/voucher|partial|goodwill|easyjet|small offer|low offer/.test(t)) return "negotiation";
  return "easy_win";
}

async function createCampaign(req: Request, message: TelegramMessage, description: string) {
  const origin = new URL(req.url).origin;
  const company = guessCompany(description);
  const demoMode = process.env.ENABLE_DEMO_MODE === "1";
  const scenario = demoMode ? pickScenario(description) : undefined;

  const response = await fetch(`${origin}/api/grievances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description,
      notifyVia: { telegram: { chatId: String(message.chat.id) } },
      ...(company ? { facts: { company } } : {}),
      ...(demoMode
        ? { metadata: { demoMode: true, scenario } }
        : {}),
    }),
  });
  if (!response.ok) throw new Error(`create grievance failed: ${response.status}`);
  return (await response.json()) as { id?: string; grievance?: { id?: string } };
}

async function handleFollowUp(req: Request, chatId: string, text: string) {
  const origin = new URL(req.url).origin;
  const response = await fetch(`${origin}/api/grievances`, { cache: "no-store" });
  if (!response.ok) {
    await postMessage(chatId, "I cannot reach the campaign record right now.");
    return;
  }

  const data = (await response.json()) as {
    campaigns?: Array<{ id: string; status: string; facts?: { company?: string } }>;
    grievances?: Array<{ id: string; status: string; facts?: { company?: string } }>;
  };
  const campaigns = data.campaigns ?? data.grievances ?? [];
  const match =
    campaigns.find((campaign) =>
      campaign.facts?.company ? text.toLowerCase().includes(campaign.facts.company.toLowerCase()) : false
    ) ?? campaigns[0];

  if (!match) {
    await postMessage(chatId, "No campaigns are open yet. Send me what happened and I will start one.");
    return;
  }

  await postMessage(
    chatId,
    `*${match.facts?.company ?? "Campaign"}* is currently *${match.status.replaceAll("_", " ").toLowerCase()}*.\nReference: \`${match.id}\``
  );
}

async function handleMessage(req: Request, message: TelegramMessage) {
  const chatId = String(message.chat.id);
  const text = message.text?.trim();

  if (text === "/start") {
    await postMessage(
      chatId,
      "Send me a short description or voice note about a consumer problem. I will prepare the claim, ask before anything goes out, and keep the record moving."
    );
    return;
  }

  if (message.voice) {
    // TODO(Claude Code): expose a safe src/lib transcription helper that does not throw at module load,
    // then replace this placeholder with Whisper-through-Gateway transcription before createCampaign().
    await postMessage(
      chatId,
      "I received the voice note, but transcription wiring is still being connected. Send the same details as text for this run."
    );
    return;
  }

  if (!text) {
    await postMessage(chatId, "Send me a description of what happened.");
    return;
  }

  if (isFollowUp(text)) {
    await handleFollowUp(req, chatId, text);
    return;
  }

  await telegram("sendChatAction", { chat_id: chatId, action: "typing" });
  await postMessage(chatId, "✅ Message received. Building your campaign now — open the dashboard to watch it start.");
  try {
    const result = await createCampaign(req, message, text);
    const id = result.grievance?.id ?? result.id;
    await postMessage(
      chatId,
      id
        ? `Started campaign \`${id.slice(0, 8)}\`. I will send the draft for approval when it is ready.`
        : "Campaign started. I will send the draft for approval when it is ready."
    );
  } catch {
    await postMessage(
      chatId,
      "I captured the message, but the campaign service is not reachable yet. Try again in a minute."
    );
  }
}

async function handleCallback(req: Request, callback: z.infer<typeof callbackQuerySchema>) {
  const chatId = callback.message?.chat.id ? String(callback.message.chat.id) : undefined;
  const [action, grievanceId] = parseCallbackData(callback.data);

  if (!chatId || !grievanceId || !isApprovalAction(action)) {
    await telegram("answerCallbackQuery", { callback_query_id: callback.id });
    return;
  }

  if (action === "edit") {
    await postMessage(chatId, "Send the edits as a reply and I will revise the draft.");
    await telegram("answerCallbackQuery", { callback_query_id: callback.id });
    return;
  }

  const origin = new URL(req.url).origin;
  await fetch(`${origin}/api/grievances/${grievanceId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  await telegram("answerCallbackQuery", { callback_query_id: callback.id });
  await postMessage(chatId, action === "approve" ? "Approved. I will let you know when they reply." : "Cancelled.");
}

function isApprovalAction(action: string | undefined): action is "approve" | "edit" | "cancel" {
  return action === "approve" || action === "edit" || action === "cancel";
}

function parseCallbackData(data: string): [string | undefined, string | undefined] {
  if (data.includes(":")) {
    const [action, grievanceId] = data.split(":");
    return [action, grievanceId];
  }

  try {
    const parsed = JSON.parse(data) as { action?: unknown; grievanceId?: unknown };
    return [
      typeof parsed.action === "string" ? parsed.action : undefined,
      typeof parsed.grievanceId === "string" ? parsed.grievanceId : undefined,
    ];
  } catch {
    return [undefined, undefined];
  }
}

export async function POST(req: Request) {
  // Telegram disables a webhook after repeated non-2xx responses, so we
  // always return 200 — internal errors are logged and surfaced via the
  // chat reply, never propagated up.
  try {
    const parsed = telegramUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      console.warn("[telegram] payload validation failed", parsed.error.issues);
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (parsed.data.callback_query) {
      await handleCallback(req, parsed.data.callback_query).catch((e) =>
        console.error("[telegram] callback handler crashed", e),
      );
    } else if (parsed.data.message) {
      await handleMessage(req, parsed.data.message).catch((e) =>
        console.error("[telegram] message handler crashed", e),
      );
    }
  } catch (e) {
    console.error("[telegram] webhook crashed", e);
  }

  return NextResponse.json({ ok: true });
}
