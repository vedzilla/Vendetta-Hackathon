# Demo Script — The 3-Minute Pitch

This is what you actually do on stage. Memorise the **beats**, improvise the words. Time it before you go up.

## The structural insight

Most live agent demos show the *opening move* and ask judges to imagine the rest. *"Now picture this campaign continuing for three weeks…"* — judges nod politely, but they leave the room with one image (a draft letter being approved) when the actual product is the seventeen things that happen after.

Vendetta solves this by **compressing time, not skipping it**. Every demo run hits the real workflow code path — same WDK durability, same Mubit memory, same Bright Data tools — with two differences:

1. `sleep("14 days")` is divided by `demoScale = 12000` → 14 days becomes ~10 seconds.
2. A `simulateReplies` workflow injects pre-scripted, plausibly-worded company replies through the same Resend inbound webhook real replies use.

The workflow doesn't know the difference. Judges see the entire iceberg in 90 seconds. See `09_DEMO_MODE.md` for the technical design.

## Setup (before pitch)

- Phone unlocked, Telegram open in DM with `@VendettaAgentBot`.
- **Browser tab 1:** dashboard `vendetta.vercel.app` with at least 5 visible campaigns — 2 real EU261 ones you started Friday evening (organically at different stages by Saturday afternoon), plus 3 seeded fakes from other categories (parking fine, subscription cancellation, train delay).
- **Browser tab 2:** Vercel `/workflows` observability dashboard, signed in.
- **Browser tab 3:** A second view of the dashboard with `?dev=1` so the DEMO CONTROL panel is visible.
- Mic checked. Backup video loaded as a tab in case the live demo dies (the **Escalation** scenario, pre-recorded).

## The 3 minutes (timed)

### **0:00–0:20 — The hook**

> "Quick show of hands — who in this room has been wronged by a company in the last twelve months and just… gave up because pursuing it felt like a part-time job?"
>
> *[Pause for hands. There will be many.]*
>
> "Right. The legal entitlement is real. The reason we don't claim is operational — by day three of email tag we've forgotten what we sent. **Vendetta is your unpaid junior solicitor.** You describe a grievance once, it pursues for weeks autonomously, and gets smarter on every case."

### **0:20–0:50 — The live trigger (Scenario 1: Easy Win, ~25s of demo)**

Pick up the phone. Open Telegram. Hold up the mic.

> *[Voice note]:* "Wizz Air delayed my flight from Luton to Budapest by four hours yesterday, the third of May, booking reference W6-9XYZ. I want compensation."

Send. Camera back to projector.

> "Whisper just transcribed that on the AI Gateway. A workflow started. Watch the dashboard."

The dashboard shows the new campaign appear, status `RESEARCHING`. ~3 seconds later, `DRAFTING`. ~5 seconds in, the Telegram bot pings — a card with the draft and approval buttons. Hold up the phone.

> "Drafted. EU261 case worth £220. Article 7 cited. Wizz Air's complaints address found via Bright Data. One tap."

Tap **Approve**. The card flips to "Sent ✓". The dashboard timeline grows a "sent" event.

> "Now — in the real world this is where you wait two weeks. In demo mode I've compressed two weeks into ten seconds. Watch."

The status pill flips to `AWAITING_REPLY`, the FAST FORWARD `▶▶ FF ×12000` indicator appears next to the company name. Timeline events tick past:
- *Day 4: System acknowledged*
- *Day 9: Wizz Air response — full settlement £220*
- *Status: WON*

Three new lesson cards fade into the right rail with the stagger animation.

> "**Twenty-three days. Ten seconds. Three new lessons stored in Mubit.** Every future Wizz Air case starts with these baked in."

### **0:50–1:20 — The reveal: this isn't a tech demo, it's a working agent**

Don't move on yet. Stay on the dashboard.

> "I want to be clear about what you just saw. That wasn't a slideshow. The same TypeScript file ran the real and the demo path — only difference is the sleep durations and the source of the inbound replies."

Switch to **Vercel /workflows** tab.

> "Here's the actual Workflow trace. *[Point at the gantt-style step view.]* Real WDK steps. Real durable function. If I redeploy mid-campaign — and I did three times yesterday — the run resumes exactly where it stopped."

Click into the trace, scroll the timeline.

> "And these *[switch back to dashboard, point at the 2 real campaigns]* — are real campaigns I started yesterday on my actual flight history. One's still waiting on a reply from BA. One escalated to the CAA last night. They're running while we speak."

### **1:20–2:30 — The climax: Scenario 3 (Escalation, ~80s of demo)**

> "But the real product story isn't the easy win. It's what happens when the company says no. Watch."

Tap the **🔥 Escalation** button on the dev panel. A new campaign appears: `Ryanair`, status `RESEARCHING`. Talk over the action:

> "Different airline this time — Ryanair, five-hour delay, Stansted to Krakow. Watch the timeline."

The campaign progresses through the script:
- 0:00 — `DRAFTING` → letter sent
- 0:15 — Ryanair reply: rejection citing extraordinary circumstances (ATC restrictions)
- 0:25 — Agent decision: counter, demand NOTAM evidence
- 0:40 — Ryanair: "final response, unable to provide NOTAM"
- 0:55 — `ESCALATED` — case filed with AviationADR
- 1:10 — AviationADR adjudication: claim upheld, full £220 ordered
- 1:15 — `WON`. Five new lessons fade into the rail.

Talk over the lesson reveal:

> "Look at what just landed. *['Ryanair frequently cites ATC extraordinary circumstances without evidence — always demand the NOTAM reference'].* *['AviationADR rules in passenger's favour when airline cannot substantiate ATC claims with documentation'].* *['Ryanair never settles in negotiation — escalation is always the right call after the first rejection'].* These are stored in Mubit. **Tomorrow's Ryanair case starts with the playbook for winning a Ryanair case.**"

Switch focus to the right rail.

> "And it's not just one airline, one category. Look at the rail — parking fines, subscription cancellations, train delays. Every category teaches every other. The fiftieth case on Wizz Air starts with everything the first forty-nine learned, plus pattern lessons from every other consumer-rights campaign that's run."

### **2:30–3:00 — The close**

Pause. Eye contact.

> "There are sixty-seven million people in the UK. Most of them are owed money they will never claim. **Vendetta is for them.**"
>
> "Built on Vercel — Workflow SDK for the durability, AI Gateway for the brain, ChatSDK for the surfaces. Mubit for the memory that compounds. Bright Data for the eyes on the web."
>
> "£2.5k won't change my life. **But Vendetta might change a million people's.**"
>
> "Thanks."

---

## The "I get to choose mid-pitch" rule

You have three demo scenarios. You don't have to commit to which one until 30 seconds before stage:

| Scenario | Duration | When to use |
|----------|----------|-------------|
| **Easy Win** | ~25s | If the room is restless / running behind schedule / you're nervous. |
| **Negotiation** | ~50s | The default. Best balance of "shows agent judgement" and time. |
| **Escalation** | ~80s | If you're confident and have full 3 minutes. Biggest emotional payoff (the CAA upholds the claim). |

The script above uses **Easy Win** as the live trigger and **Escalation** as the climax. If you're tight on time, swap the climax for **Negotiation** (~50s).

If a scenario fails on stage — workflow errors, dashboard freezes — **move on to the next without acknowledging**. The dev panel has three buttons. You have three lives. Don't apologize.

## Q&A prep (likely judge questions)

### "How is this different from a chatbot that drafts complaint letters?"

> "Two things: durability and memory. A chatbot draft is one conversation, one letter, one shot. Vendetta runs for weeks — sleeps until the legal response window, wakes when the airline replies, decides whether to accept or escalate, files with the regulator if needed. And every campaign teaches the next via Mubit, so the tenth letter is measurably better than the first."

### "The compressed demo — was that real, or was it pre-recorded?"

> "Real, just time-scaled. Open the Vercel observability tab and you can see the actual WDK run with the actual steps. The synthetic part is the company replies — for the demo we inject scripted replies through the same inbound webhook real replies use. Workflow code is identical for real and demo paths."

### "What stops the airline from just ignoring it?"

> "The deadlines are statutory — 8 weeks for UK aviation cases. The escalation path is automatic — we file with the CAA on the user's behalf when ignored. And Vendetta tracks lessons across users — when one Wizz Air case fails because of an excuse, every future Wizz Air case starts with the counter to that excuse pre-loaded."

### "Are you sure this is legal?"

> "Yes. The user is the claimant — Vendetta is their drafting and tracking tool. They approve every outbound message. We're not impersonating a solicitor; we're more like the Microsoft Word that does the follow-up. Same way TurboTax doesn't make you a CPA."

### "How would you commercialize?"

> "Two paths: free for the first claim, then £5/month for unlimited tracking, OR a success fee — 25% of recovered cash. The success-fee model is what no-win-no-fee firms charge, and Vendetta does it without humans. Margins are 80%+."

### "What's the moat?"

> "Mubit. Every campaign — across every user — feeds the lesson pool. The thousandth Wizz Air case starts with everything the first 999 learned. That's a flywheel a competitor would need years of operational data to reproduce."

### "Why didn't you build this in Track 2 with v0?"

> "v0 is great for the dashboard layer — and we used it. But Track 1 is the reason this works. A v0 + MCP project can ask for a refund. Only WDK lets the agent *wait three weeks for one* and pick up where it left off. That's the actual product."

### "Did you really build this in a day?"

> "The application yes — built today, on stage now. The strategy and the docs were prepared the night before, which is fair game. All the code is in the public repo."

---

## Mistakes to avoid

- **Don't read the slide.** There is no slide. You're a person on stage with a phone and a dashboard.
- **Don't talk over your own demo.** When the Telegram card pops up, when the FAST FORWARD kicks in, when the lessons fade — let those land for a beat.
- **Don't mention Anthropic / OpenAI / Claude as the model.** Mention "the agent". Judges don't care which LLM; they care about the product.
- **Don't apologise for unfinished features.** If something's missing, don't mention it.
- **Don't go over time.** A 3:15 pitch with the perfect line in it loses to a 2:50 pitch that ended on the punchline.
- **Don't let nervous laughter creep in.** Hands-on-the-podium calm.
- **Don't skip the "this is real WDK" tab switch.** It's the proof point. Without it, judges may suspect the compressed demo is fake.

## The two lines that stick

> "**It pursues it for weeks, autonomously, getting smarter on every case.**"

> "**Twenty-three days. Ten seconds. Three new lessons.**"

Use the first one in the hook. Use the second one over the FAST FORWARD moment. They're the entire pitch in twenty words combined.
