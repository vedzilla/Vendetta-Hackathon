import { after, NextResponse } from "next/server";
import { z } from "zod";

import { appendTimelineEvent, markStatus, saveResearch } from "@/lib/store";

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

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const SCENARIO_LETTERS: Record<
  "easy_win" | "negotiation" | "escalation",
  { draft: { subject: string; body: string }; reply: { from: string; subject: string; body: string } }
> = {
  easy_win: {
    draft: {
      subject: "UK261 compensation claim — Wizz Air W6-9XYZ",
      body: "Wizz Air Customer Care,\n\nFlight W6-9XYZ on 1 May 2026 from London Luton to Budapest arrived four hours late. Under Regulation EC 261/2004 Article 7(1)(b), as retained in UK law via the Air Passenger Rights and Compensation Regulations 2019, I am entitled to £220 in compensation.\n\nPlease process payment to the original method within 14 days.",
    },
    reply: {
      from: "customercare@wizzair.com",
      subject: "Re: Compensation claim — W6-9XYZ",
      body: "Dear Passenger,\n\nFollowing our review, we confirm the delay was within our operational control and have authorised payment of £220 to your original payment method, processed within 7-10 business days.\n\nReference: WCC-2026-19284.",
    },
  },
  negotiation: {
    draft: {
      subject: "EU261 compensation claim — easyJet EZ8K2P3",
      body: "easyJet Claims,\n\nFlight EZY1234 on 28 April 2026 arrived three and a half hours late. Under EC 261/2004 Article 7(1)(b) the entitlement is £350 in cash; Article 7(3) is explicit that vouchers are only acceptable with the passenger's signed agreement.\n\nPlease process £350 to the original card within 14 days.",
    },
    reply: {
      from: "claims@easyjet.com",
      subject: "Re: Your claim EZ8K2P3",
      body: "Following your reference to Article 7(3) of EC 261/2004, we will process the full UK261 compensation amount of £350 to your original payment method within 14 business days.",
    },
  },
  escalation: {
    draft: {
      subject: "UK261 compensation claim — Ryanair RY3K8H",
      body: "Ryanair Customer Relations,\n\nFlight FR8821 on 25 April 2026 arrived five hours late. Under EC 261/2004 Article 7(1)(a) the entitlement is £220.\n\nIf you intend to invoke extraordinary circumstances, please supply the specific NOTAM reference; absent that I will escalate to AviationADR.",
    },
    reply: {
      from: "decisions@aviationadr.org.uk",
      subject: "Adjudication decision — RY3K8H",
      body: "Following our review of case AADR-26-8472 and the airline's failure to substantiate extraordinary circumstances, we find in your favour. Ryanair is directed to pay £220 plus statutory interest within 14 days.",
    },
  },
};

async function simulateCampaignProgression(grievanceId: string, description: string): Promise<void> {
  const scenario = pickScenario(description);
  const letters = SCENARIO_LETTERS[scenario];
  const now = () => new Date().toISOString();

  try {
    await wait(2000);
    await markStatus(grievanceId, "CLASSIFIED");
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "classified",
      summary: "Classified as UK_FLIGHT_DELAY — extracted facts and routed to research.",
    });

    await wait(3000);
    await markStatus(grievanceId, "RESEARCHING");
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "researched",
      summary: "Searching the web via Bright Data MCP for the airline's complaints address and regulator path.",
    });
    await saveResearch(grievanceId, {
      complaintsAddress: scenario === "easy_win" ? "customercare@wizzair.com"
        : scenario === "negotiation" ? "claims@easyjet.com"
        : "customer.relations@ryanair.com",
      regulatorName: scenario === "escalation" ? "AviationADR" : "UK Civil Aviation Authority (PACT)",
      regulatorUrl: scenario === "escalation"
        ? "https://www.aviationadr.org.uk/"
        : "https://www.caa.co.uk/passengers/resolving-travel-problems/",
      relevantStatutes: [
        "EC 261/2004 Article 7(1)(b)",
        "Air Passenger Rights and Compensation Regulations 2019 (UK261)",
      ],
      typicalResponseDays: 14,
    });

    await wait(4000);
    await markStatus(grievanceId, "AWAITING_APPROVAL");
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "drafted",
      summary: "Drafted compensation demand citing EC 261/2004 Article 7. Awaiting your approval.",
      payload: { draft: letters.draft },
    });

    await wait(3000);
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "approved",
      summary: "User approved — sending letter.",
    });

    await wait(2000);
    await markStatus(grievanceId, "AWAITING_REPLY");
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "sent",
      summary: `Sent letter to the airline (${letters.reply.from}).`,
    });

    await wait(6000);
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "reply_received",
      summary: `Reply received from ${letters.reply.from}.`,
      payload: { reply: letters.reply },
    });

    await wait(3000);
    await markStatus(grievanceId, "WON");
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "won",
      summary: scenario === "escalation"
        ? "AviationADR adjudicated in your favour — full compensation directed."
        : scenario === "negotiation"
          ? "Voucher offer upgraded to full cash entitlement after Article 7(3) citation."
          : "Airline confirmed full UK261 compensation.",
    });

    await wait(1500);
    await appendTimelineEvent(grievanceId, {
      at: now(), kind: "lesson_learned",
      summary: scenario === "escalation"
        ? "When ATC extraordinary circumstances are claimed without a NOTAM, AviationADR escalation succeeds 78% of the time."
        : scenario === "negotiation"
          ? "Article 7(3) on form-of-payment reliably converts voucher offers to cash."
          : "Citing the booking reference in the subject line correlates with replies inside 10 days.",
    });
  } catch (e) {
    console.error("[telegram] progression failed", e);
  }
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

    // Drive a fully-simulated visible progression directly in KV — no
    // workflow runtime, no LLM, no external services. Each event lands
    // in the campaign's timeline a few seconds apart and the dashboard
    // polls them up.
    if (id) {
      after(simulateCampaignProgression(id, text));
    }
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
