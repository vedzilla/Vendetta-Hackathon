# Integration: ChatSDK + Telegram

The phone-first surface. This is what makes the demo magical — judges see you record a voice note on your iPhone and watch Vendetta respond.

**Docs:** https://chat-sdk.dev/docs
**Slack guide (similar pattern):** https://vercel.com/kb/guide/how-to-build-an-ai-agent-for-slack-with-chat-sdk-and-ai-sdk
**Repo:** https://github.com/vercel/chat

## Why Telegram (not Slack/WhatsApp/iMessage)

- **60-second setup** via @BotFather. No app review, no business verification.
- **Voice notes work natively** — Telegram sends them as audio attachments; ChatSDK normalizes them.
- **Looks identical to iMessage** to judges in the back row. Don't overthink the platform choice.
- **Free, no rate limits for our scale.**

WhatsApp via ChatSDK works too, but requires a verified WhatsApp Business number — not worth the time.

## One-time setup (Friday night)

1. Open Telegram, message `@BotFather`.
2. Send `/newbot`.
3. Pick a name: `Vendetta Agent` (display name).
4. Pick a username: `VendettaAgentBot` if free, otherwise variants.
5. Save the API token it gives you. This is `TELEGRAM_BOT_TOKEN` in `.env.local`.
6. Send `/setprivacy` → `Disable` (so the bot can read group messages too — useful if someone wants to add Vendetta to a group complaint chat).
7. After deployment, set the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://vendetta.vercel.app/api/webhooks/telegram"
   ```

## Install

```bash
pnpm add chat @chat-adapter/telegram @chat-adapter/state-redis
```

## Bot setup module (`src/lib/chat.ts`)

```ts
import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createRedisState } from "@chat-adapter/state-redis";

export const bot = new Chat({
  userName: "vendetta",
  adapters: {
    telegram: createTelegramAdapter({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
    }),
  },
  state: createRedisState({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  }),
});
```

## Webhook handler (`src/app/api/webhooks/telegram/route.ts`)

```ts
import { bot } from "@/lib/chat";

export const POST = async (req: Request) => {
  return bot.handleRequest(req, "telegram");
};
```

## Event handlers (in `src/lib/chat.ts`, after `bot` is created)

### Handler 1: New message in DM = new grievance

```ts
import { transcribe, generateText } from "ai";
import { fastModel, transcriptionModel } from "@/lib/ai";
import { createGrievance } from "@/lib/store";
import { pursueGrievance } from "@/workflows/pursue-grievance";

bot.onMessage(async (thread, message) => {
  // 1. Get the text content (transcribe if voice)
  let text = message.text;

  if (!text && message.attachments?.some((a) => a.type === "audio")) {
    await thread.post("🎙️ Got your voice note, transcribing...");
    const audioAttachment = message.attachments.find((a) => a.type === "audio")!;
    const audioBuffer = await fetch(audioAttachment.url).then((r) => r.arrayBuffer());
    const result = await transcribe({
      model: transcriptionModel,
      audio: audioBuffer,
    });
    text = result.text;
    await thread.post(`📝 *"${text}"*`);
  }

  if (!text) {
    await thread.post("Send me a description of what happened — text or voice note.");
    return;
  }

  // 2. Quick check: is this a new grievance or a reply to an existing one?
  const intent = await classifyIntent(text);  // helper that decides
  if (intent === "follow_up") {
    return handleFollowUp(thread, message, text);  // see Handler 2
  }

  // 3. New grievance flow
  await thread.post("On it. Investigating...");

  const grievance = await createGrievance({
    rawDescription: text,
    notifyVia: { telegram: { chatId: thread.id } },
  });

  await pursueGrievance.start({ grievanceId: grievance.id });

  await thread.post(
    `🔥 Started campaign \`${grievance.id.slice(0, 8)}\`. ` +
    `I'll send you a draft to approve in under a minute.`
  );
});
```

### Handler 2: Approval card button taps

ChatSDK supports interactive buttons via "Cards". When you post a card with buttons, taps come through `bot.onAction`.

```ts
import { Card, Button } from "chat";
import { invokeHook } from "workflow";

// When a draft is ready, the workflow posts an approval card:
export async function postApprovalCard(grievanceId: string, draft: { subject: string; body: string }) {
  "use step";

  const grievance = await loadGrievance(grievanceId);
  const chatId = grievance.notifyVia.telegram?.chatId;
  if (!chatId) return;

  const thread = bot.getThread("telegram", chatId);
  await thread.postCard(
    <Card title={`Draft ready: ${draft.subject}`}>
      <pre>{draft.body}</pre>
      <Button action="approve" data={{ grievanceId }} primary>
        ✅ Approve & Send
      </Button>
      <Button action="edit" data={{ grievanceId }}>
        ✏️ Edit
      </Button>
      <Button action="cancel" data={{ grievanceId }} danger>
        ❌ Cancel
      </Button>
    </Card>
  );
}

// And the action handler resumes the workflow:
bot.onAction("approve", async (thread, { data }) => {
  await invokeHook(`approval:${data.grievanceId}`, { action: "approve" });
  await thread.post("✅ Sent. I'll let you know when they reply.");
});

bot.onAction("cancel", async (thread, { data }) => {
  await invokeHook(`approval:${data.grievanceId}`, { action: "cancel" });
  await thread.post("Cancelled.");
});

bot.onAction("edit", async (thread, { data }) => {
  await thread.post("What would you like changed? Reply with your edits.");
  // The next message in this thread becomes the edit, handled in onMessage by checking for pending-edit state in KV.
});
```

### Handler 3: Status updates ("how's my Wizz Air case?")

```ts
async function handleFollowUp(thread, message, text) {
  // Use a small LLM to figure out which grievance they're asking about
  const grievances = await listGrievancesByChatId(thread.id);
  const { match } = await generateText({
    model: fastModel,
    prompt: `User said: "${text}". Their open grievances: ${JSON.stringify(grievances.map(g => ({ id: g.id, company: g.facts.company, status: g.status })))}. Return JSON {"matchId": "..."} or {"matchId": null}.`,
  });
  const matchedId = JSON.parse(match).matchId;
  if (!matchedId) {
    await thread.post("Which campaign? You have: " + grievances.map(g => `${g.facts.company} (${g.status})`).join(", "));
    return;
  }
  const g = await loadGrievance(matchedId);
  // Post a nicely formatted status summary
  await thread.post(formatStatus(g));
}
```

## Voice transcription details

The AI SDK's `transcribe()` works with any provider that supports it. Whisper via OpenAI through the Gateway is the default:

```ts
import { transcribe } from "ai";
import { gateway } from "ai";

const transcriptionModel = gateway("openai/whisper-1");

const result = await transcribe({
  model: transcriptionModel,
  audio: audioBuffer,  // ArrayBuffer or Buffer
});
console.log(result.text);
```

For Telegram voice notes specifically, the audio comes as `.ogg` (Opus codec). Whisper handles this natively, no transcoding needed.

## Stretch goal: ship to Slack too

This is a TWO LINE addition that earns you a "ships everywhere" demo line:

```ts
import { createSlackAdapter } from "@chat-adapter/slack";

export const bot = new Chat({
  userName: "vendetta",
  adapters: {
    telegram: createTelegramAdapter({ botToken: process.env.TELEGRAM_BOT_TOKEN! }),
    slack: createSlackAdapter(),  // auto-reads SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET
  },
  state: createRedisState({ ... }),
});
```

Add a Slack route handler at `src/app/api/webhooks/slack/route.ts` (one line). Done.

## What to mention to ChatSDK / Vercel judges

In your README:
- "Built on Vercel ChatSDK so the same agent ships to Telegram, Slack, Discord, and Linear from one codebase."
- "JSX-based interactive cards make the human-in-the-loop approval flow native to every platform."
- "Voice notes via Whisper through the AI Gateway — no third-party transcription service."

These are the lines Vercel's judges want to hear because they reinforce the "write once, deploy everywhere" pitch for ChatSDK.
