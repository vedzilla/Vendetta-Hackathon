# Grievance Vertical: UK Flight Delay (EU261 / UK261)

This is the legal and operational knowledge the agent needs. Everything here should be encoded as Mubit `fact` entries during seed setup, plus baked into the system prompts.

## Why this vertical for v1

- Rules are clearly defined and well-documented.
- Compensation amounts are quantified (€250 / €400 / €600 in EU, £220 / £350 / £520 in UK).
- The complaint pathway is standard: airline first → CAA / appropriate regulator second.
- Most adults have experienced a flight delay.
- Demo's emotional resonance is universal in a London hackathon room.

## The legal frame

**UK261** (Air Passenger Rights and Compensation Regulations 2019) is the UK's retained version of **EU Regulation 261/2004** post-Brexit.

### Eligibility

A passenger is entitled to compensation when:
- The flight departed from a UK airport (any airline), OR
- The flight arrived at a UK airport on a UK or EU airline.
- AND the delay was ≥ 3 hours at arrival (NOT at departure — common confusion).
- AND the cause was within the airline's control (NOT "extraordinary circumstances" like extreme weather, ATC strike, security threat).

### Compensation tiers

| Distance | Delay | UK261 amount | EU261 amount |
|----------|-------|---------------|---------------|
| ≤ 1,500 km | 3+ hours | £220 | €250 |
| 1,500–3,500 km (or any intra-EU > 1,500 km) | 3+ hours | £350 | €400 |
| > 3,500 km (non-EU) | 3–4 hours | £260 | €300 |
| > 3,500 km (non-EU) | 4+ hours | £520 | €600 |

### Citations to use

- **EU flights:** "Article 7(1)(a)" for short, "Article 7(1)(b)" for medium, "Article 7(1)(c)" for long-haul.
- **UK flights:** Same article numbers from the retained regulation.
- **Right to care:** "Article 9" — meals, refreshments, hotel if overnight delay.
- **Right of choice:** "Article 8" — refund vs re-routing.

### Common airline objections + responses

| Airline objection | Counter |
|-------------------|---------|
| "Extraordinary circumstances" (weather, ATC) | Demand specific evidence (NOTAM number, ATC reference). If the airline's other flights operated normally, it's not extraordinary. |
| "Compensation already paid as voucher" | Cite Article 7(3): payment must be in cash, bank transfer, or by passenger consent. |
| "Outside the 6-year limitation period" | (For UK) actually 6 years under Limitation Act 1980. (For EU) 2 years for direct air carrier liability under Montreal Convention; varies by country for compensation claims. |
| "Codeshare / operating carrier" | Compensation liability is on the OPERATING carrier, not the marketing one. |
| "We offered re-routing within 2 hours" | Re-routing doesn't extinguish compensation right unless arrival was ≤ 2 hours later. |

## Escalation pathway

1. **Airline complaints department** — first stop. 8-week response window per CAA guidance.
2. **Alternative Dispute Resolution (ADR)** — most UK airlines are signed up to either:
   - **AviationADR** (handles BA, Virgin, easyJet)
   - **CEDR** (handles Ryanair, Wizz Air, etc.)
3. **CAA Passenger Advice and Complaints Team (PACT)** — only after airline AND ADR are exhausted, OR if airline isn't ADR-signed.
4. **Small Claims Court (England/Wales)** — claims under £10,000 via Money Claim Online (£25–£455 fee, refundable on win).

## Major UK/EU airlines — pre-cached data

These should go into Mubit as `fact` entries on first run. After that the agent looks them up; before then, seed them:

| Airline | Complaints email | ADR provider | Avg response (days) |
|---------|------------------|--------------|---------------------|
| British Airways | customer.relations@ba.com | CEDR | 21 |
| Wizz Air | customercare@wizzair.com | AviationADR | 9 |
| easyJet | claims@easyjet.com | AviationADR | 14 |
| Ryanair | https://eu261.ryanair.com (form only) | AviationADR | 18 |
| Virgin Atlantic | customer.care@fly.virgin.com | CEDR | 28 |
| Jet2 | customer.relations@jet2.com | AviationADR | 12 |
| TUI Airways | customer.services@tui.co.uk | AviationADR | 21 |
| Lufthansa | customer.relations.lh@dlh.de | söp (Germany) | 30 |
| Air France | mail.uk@airfrance.fr | MTV (France) | 45 |
| KLM | customer.care@klm.com | SGOAC (Netherlands) | 30 |

(These are illustrative; verify before send. The agent can fall back to Bright Data lookup if a value seems stale.)

## Letter template structure

The drafted letter should follow this structure (the LLM will handle wording, but the structure is encoded in the prompt):

```
[Subject: Compensation claim under UK261/EC261 — [Airline] [Flight Number] on [Date]]

Dear Customer Relations Team,

[Paragraph 1: Identify yourself, booking ref, route, scheduled vs actual times.]

[Paragraph 2: State the delay duration and that you arrived X hours late.]

[Paragraph 3: Cite the relevant Article and request the specific cash amount.]

[Paragraph 4: Cite Article 9 for any care expenses (meal, hotel) if applicable, with receipts.]

[Paragraph 5: Set a clear deadline (14 days) and reference the next escalation step.]

Yours faithfully,
[Name]
```

Key principles to encode in the prompt:
- Always include the booking reference and flight number in the subject.
- Always quote the EXACT statute article.
- Always specify the EXACT amount in £/€.
- Always set a hard deadline.
- Never threaten litigation in letter 1; reserve for letter 3+ after CAA escalation.

## Mubit seed lessons (for the demo)

These give `surfaceStrategies()` real material when judges look at the dashboard:

```ts
const SEED_LESSONS_EU261 = [
  "Wizz Air typically responds to EU261 claims within 9–11 days when Article 7 is cited explicitly in the first paragraph and the booking reference is in the subject line.",
  "easyJet rejects claims that don't include the original boarding pass image attached as PDF.",
  "Ryanair's first response is almost always a £40 voucher offer; counter with the full cash entitlement and cite Article 7(3) on form of payment.",
  "British Airways accepts EU261 claims faster when the second escalation letter is addressed to the Customer Care Director found via LinkedIn.",
  "The UK CAA's PACT submission requires airline final response in writing AND proof of 8 weeks elapsed since first complaint.",
  "Jet2 sometimes claims 'extraordinary circumstances' for delays under 4 hours; demand the NOTAM reference and AOC report.",
  "Sending the initial complaint Tuesday morning UK time correlates with faster first responses than Friday afternoons.",
  "CEDR (the ADR for Ryanair/Wizz) requires £25 fee from the airline, not the passenger — mention this in the escalation letter.",
];
```

## What the agent must NOT do

- Never claim representation of the user as a solicitor or other regulated professional.
- Never threaten criminal proceedings — these are civil matters.
- Never demand more than the statutory entitlement (don't pad).
- Never hallucinate case law. If citing case law, only cite cases that the agent has actually verified via Bright Data search (Sturgeon v Condor C-402/07 and Nelson v Lufthansa C-581/10 are the safe canonical EU261 cases — the agent can use these by name).
- Never send without explicit user approval. Hard rule.
