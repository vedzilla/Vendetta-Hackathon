/**
 * Static multi-vertical campaigns for the dashboard backdrop. These NEVER
 * trigger workflows — they are KV records hand-written so the dashboard
 * looks alive and the "works for any consumer grievance" platform claim is
 * visually substantiated without us building four live verticals.
 *
 * `metadata.seeded = true` is the discriminator. The intake API and the
 * dashboard's filters use this to keep seeded fakes out of any path that
 * would try to start a workflow against them.
 */

import type { Grievance, TimelineEvent } from "@/types/grievance";

import { upsertGrievance } from "./store";

const SEEDED_USER_ID = "demo-seed";

function eventsAt(events: Array<Omit<TimelineEvent, "at"> & { daysAgo: number }>): TimelineEvent[] {
  const now = Date.now();
  return events.map((e) => ({
    at: new Date(now - e.daysAgo * 86_400_000).toISOString(),
    kind: e.kind,
    summary: e.summary,
    payload: e.payload,
  }));
}

const PARKING_FINE_ESCALATED: Grievance = (() => {
  const timeline = eventsAt([
    { daysAgo: 32, kind: "received", summary: "PCN PE-2026-44913 received via voice note from user" },
    { daysAgo: 32, kind: "classified", summary: "Classified as PARKING_FINE — operator: ParkingEye" },
    { daysAgo: 31, kind: "researched", summary: "Identified POPLA as appeals body; located ParkingEye signage spec" },
    { daysAgo: 30, kind: "approval_requested", summary: "Draft appeal letter awaiting user approval" },
    { daysAgo: 30, kind: "approved", summary: "User approved appeal" },
    { daysAgo: 30, kind: "sent", summary: "Sent informal appeal to ParkingEye citing BPA Code of Practice 18.3" },
    { daysAgo: 21, kind: "reply_received", summary: "ParkingEye rejected appeal — no acknowledgement of signage challenge" },
    { daysAgo: 20, kind: "negotiating", summary: "Agent decided rejection lacked substance; proceeding to POPLA" },
    { daysAgo: 18, kind: "escalated", summary: "Filed POPLA appeal #POP-2026-118472 with photographic signage evidence" },
  ]);
  const now = new Date().toISOString();
  return {
    id: "seed-parking-popla",
    userId: SEEDED_USER_ID,
    category: "PARKING_FINE",
    status: "ESCALATED",
    rawDescription:
      "Got a £100 parking charge from ParkingEye at the Westgate retail park. Stayed 22 minutes, signs were tiny and behind a tree. Want this overturned.",
    facts: {
      company: "ParkingEye Ltd",
      incidentDate: "2026-03-31",
      referenceNumber: "PE-2026-44913",
      amountClaimed: 100,
      currency: "GBP",
    },
    research: {
      complaintsAddress: "appeals@parkingeye.co.uk",
      regulatorName: "POPLA (Parking on Private Land Appeals)",
      regulatorUrl: "https://www.popla.co.uk/",
      relevantStatutes: [
        "Protection of Freedoms Act 2012, Schedule 4",
        "British Parking Association Code of Practice §18.3 (signage minimum size)",
      ],
      typicalResponseDays: 14,
    },
    timeline,
    notifyVia: { telegram: { chatId: "demo" } },
    metadata: { seeded: true },
    createdAt: timeline[0].at,
    updatedAt: now,
  };
})();

const SUBSCRIPTION_WON: Grievance = (() => {
  const timeline = eventsAt([
    { daysAgo: 47, kind: "received", summary: "User reports PureGym refused cancellation despite request in Jan" },
    { daysAgo: 47, kind: "classified", summary: "Classified as SUBSCRIPTION_CANCELLATION — company: PureGym" },
    { daysAgo: 46, kind: "researched", summary: "Identified CMA pricing-practices guide and Section 50 CRA as anchors" },
    { daysAgo: 46, kind: "approved", summary: "User approved demand letter" },
    { daysAgo: 46, kind: "sent", summary: "Sent refund demand for £127.00 covering 5.5 months of unauthorised charges" },
    { daysAgo: 38, kind: "reply_received", summary: "PureGym offered 2 months credit; agent rejected, restated cash demand" },
    { daysAgo: 30, kind: "negotiating", summary: "Sent escalation citing Section 50 CRA + CMA referral threat" },
    { daysAgo: 22, kind: "reply_received", summary: "PureGym confirmed full £127 refund to original card within 14 days" },
    { daysAgo: 8, kind: "won", summary: "Refund of £127.00 received — campaign closed", payload: { amountRecovered: 127 } },
    { daysAgo: 8, kind: "lesson_learned", summary: "Lesson: PureGym pays out within 14 days when CMA referral is mentioned" },
  ]);
  const now = new Date().toISOString();
  return {
    id: "seed-puregym-won",
    userId: SEEDED_USER_ID,
    category: "SUBSCRIPTION_CANCELLATION",
    status: "WON",
    rawDescription:
      "I cancelled my PureGym membership in January but they kept charging me £23 a month until I noticed in May. Five months of charges. Want a full refund.",
    facts: {
      company: "PureGym",
      incidentDate: "2026-01-15",
      referenceNumber: "PG-MEM-882144",
      amountClaimed: 127,
      currency: "GBP",
    },
    research: {
      complaintsAddress: "memberservices@puregym.com",
      regulatorName: "Competition and Markets Authority (CMA)",
      regulatorUrl: "https://www.gov.uk/government/organisations/competition-and-markets-authority",
      relevantStatutes: [
        "Consumer Rights Act 2015, Section 50",
        "Consumer Contracts Regulations 2013, Regulation 36",
      ],
      typicalResponseDays: 10,
    },
    timeline,
    notifyVia: { telegram: { chatId: "demo" } },
    metadata: { seeded: true },
    createdAt: timeline[0].at,
    updatedAt: now,
  };
})();

const TRAIN_DELAY_AWAITING_APPROVAL: Grievance = (() => {
  const timeline = eventsAt([
    { daysAgo: 1, kind: "received", summary: "User reports 47-min Avanti delay, Manchester Piccadilly → Euston" },
    { daysAgo: 1, kind: "classified", summary: "Classified as TRAIN_DELAY — operator: Avanti West Coast" },
    { daysAgo: 0, kind: "researched", summary: "Confirmed 50% Delay Repay band (30–59 min) on £127.50 Anytime fare" },
    { daysAgo: 0, kind: "drafted", summary: "Drafted Delay Repay claim for £63.75 — awaiting user approval" },
    { daysAgo: 0, kind: "approval_requested", summary: "Approval card sent via Telegram" },
  ]);
  const now = new Date().toISOString();
  return {
    id: "seed-avanti-pending",
    userId: SEEDED_USER_ID,
    category: "TRAIN_DELAY",
    status: "AWAITING_APPROVAL",
    rawDescription:
      "Avanti West Coast delayed my 19:40 Manchester Piccadilly to London Euston by 47 minutes yesterday, ticket was an Anytime Single, £127.50.",
    facts: {
      company: "Avanti West Coast",
      incidentDate: "2026-05-01",
      amountClaimed: 63.75,
      currency: "GBP",
    },
    research: {
      complaintsAddress: "delayrepay@avantiwestcoast.co.uk",
      regulatorName: "Rail Ombudsman",
      regulatorUrl: "https://www.railombudsman.org/",
      relevantStatutes: [
        "National Rail Conditions of Travel — Delay Repay 15 Schedule",
      ],
      typicalResponseDays: 20,
    },
    timeline,
    notifyVia: { telegram: { chatId: "demo" } },
    metadata: { seeded: true },
    createdAt: timeline[0].at,
    updatedAt: now,
  };
})();

const SEEDED: Grievance[] = [
  PARKING_FINE_ESCALATED,
  SUBSCRIPTION_WON,
  TRAIN_DELAY_AWAITING_APPROVAL,
];

export async function loadSeededCampaigns(): Promise<Grievance[]> {
  return SEEDED;
}

/**
 * Idempotent seeder. Run from boot (and from a /api/demo/seed admin route)
 * so the dashboard always has the multi-vertical backdrop.
 */
export async function ensureSeededCampaignsInKv(): Promise<void> {
  await Promise.all(SEEDED.map((g) => upsertGrievance(g)));
}
