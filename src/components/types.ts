import type {
  Grievance,
  GrievanceCategory,
  GrievanceResearch,
  GrievanceStatus,
  TimelineEvent,
} from "@/types/grievance";

export type DashboardCampaign = Grievance & {
  draft?: {
    subject: string;
    body: string;
  };
};

export interface Lesson {
  id: string;
  content: string;
  category: GrievanceCategory;
  sourceCompany: string;
  outcome: "success" | "failure";
}

export interface CampaignListResponse {
  campaigns?: DashboardCampaign[];
  grievances?: DashboardCampaign[];
  lessons?: Lesson[];
}

export interface CampaignDetailResponse {
  campaign?: DashboardCampaign;
  grievance?: DashboardCampaign;
  lessons?: Lesson[];
}

export const statusLabels: Record<GrievanceStatus, string> = {
  INTAKE: "Intake",
  CLASSIFIED: "Classified",
  RESEARCHING: "Researching",
  AWAITING_APPROVAL: "Awaiting approval",
  AWAITING_REPLY: "Awaiting reply",
  NEGOTIATING: "Negotiating",
  ESCALATED: "Escalated",
  WON: "Won",
  LOST: "Lost",
  CANCELLED: "Cancelled",
};

export const categoryLabels: Record<GrievanceCategory, string> = {
  UK_FLIGHT_DELAY: "EU261",
  PARKING_FINE: "Parking",
  SUBSCRIPTION_CANCELLATION: "Subscription",
  TRAIN_DELAY: "Delay Repay",
};

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

const timeline = (events: Array<[number, TimelineEvent["kind"], string]>): TimelineEvent[] =>
  events.map(([minutesAgo, kind, summary]) => ({
    at: iso(minutesAgo),
    kind,
    summary,
  }));

export const fallbackCampaigns: DashboardCampaign[] = [
  {
    id: "demo-wizz-easy",
    userId: "demo",
    category: "UK_FLIGHT_DELAY",
    status: "AWAITING_REPLY",
    rawDescription: "Wizz Air flight from Luton to Budapest delayed by four hours.",
    facts: {
      company: "Wizz Air",
      amountClaimed: 220,
      currency: "GBP",
      referenceNumber: "W6-4H-220",
      incidentDate: "2026-04-18",
    },
    research: {
      complaintsAddress: "customerrelations@wizzair.com",
      regulatorName: "UK Civil Aviation Authority",
      regulatorUrl: "https://www.caa.co.uk/passengers/resolving-travel-problems/",
      relevantStatutes: ["Regulation EC 261/2004 Article 7(1)(b)", "UK261 retained law"],
      typicalResponseDays: 14,
    },
    timeline: timeline([
      [18, "received", "Voice note transcribed and campaign opened."],
      [16, "classified", "Matched as UK flight delay compensation."],
      [13, "researched", "Found airline complaints channel and regulator path."],
      [10, "drafted", "Drafted compensation demand for GBP 220.00."],
      [8, "approved", "User approved letter for dispatch."],
      [6, "sent", "Complaint sent to Wizz Air customer relations."],
    ]),
    notifyVia: { telegram: { chatId: "demo" } },
    workflowRunId: "run_demo_wizz_easy",
    metadata: { demoMode: true, scenario: "easy_win" },
    createdAt: iso(22),
    updatedAt: iso(6),
    draft: {
      subject: "UK261 compensation claim for delayed Wizz Air flight",
      body:
        "I am claiming compensation under Regulation EC 261/2004 Article 7(1)(b), as retained in UK law, for a delay exceeding three hours on arrival.",
    },
  },
  {
    id: "seed-parking",
    userId: "demo",
    category: "PARKING_FINE",
    status: "WON",
    rawDescription: "Private parking charge issued despite a valid payment receipt.",
    facts: {
      company: "Euro Car Parks",
      amountClaimed: 100,
      currency: "GBP",
      referenceNumber: "ECP-7710",
    },
    research: {
      regulatorName: "POPLA",
      regulatorUrl: "https://www.popla.co.uk/",
      relevantStatutes: ["Protection of Freedoms Act 2012 Schedule 4"],
    } satisfies GrievanceResearch,
    timeline: timeline([
      [240, "received", "Receipt and notice uploaded."],
      [205, "researched", "Found keeper liability defect in the notice wording."],
      [180, "sent", "Appeal submitted with payment evidence."],
      [30, "won", "Charge cancelled by operator."],
    ]),
    notifyVia: {},
    metadata: { seeded: true },
    createdAt: iso(260),
    updatedAt: iso(30),
  },
  {
    id: "seed-subscription",
    userId: "demo",
    category: "SUBSCRIPTION_CANCELLATION",
    status: "ESCALATED",
    rawDescription: "Subscription cancellation ignored after repeated support requests.",
    facts: {
      company: "StreamBox",
      amountClaimed: 47.97,
      currency: "GBP",
      referenceNumber: "SBX-443",
    },
    timeline: timeline([
      [360, "received", "Cancellation trail imported."],
      [330, "drafted", "Drafted refund request citing unfair cancellation friction."],
      [240, "reply_received", "Company offered one month refund only."],
      [90, "escalated", "Escalation pack prepared for card chargeback."],
    ]),
    notifyVia: {},
    metadata: { seeded: true },
    createdAt: iso(390),
    updatedAt: iso(90),
  },
  {
    id: "seed-train",
    userId: "demo",
    category: "TRAIN_DELAY",
    status: "AWAITING_APPROVAL",
    rawDescription: "Train arrived 78 minutes late and Delay Repay form rejected.",
    facts: {
      company: "Avanti West Coast",
      amountClaimed: 38.5,
      currency: "GBP",
      referenceNumber: "AWC-Delay-91",
    },
    timeline: timeline([
      [75, "received", "Ticket and journey details added."],
      [72, "classified", "Matched as Delay Repay escalation."],
      [65, "drafted", "Draft prepared challenging the rejection reason."],
      [64, "approval_requested", "Waiting for user approval before sending."],
    ]),
    notifyVia: {},
    metadata: { seeded: true },
    createdAt: iso(80),
    updatedAt: iso(64),
    draft: {
      subject: "Delay Repay rejection review",
      body:
        "Please review the rejected Delay Repay claim. The service arrived 78 minutes late and the ticket evidence confirms eligibility.",
    },
  },
];

export const fallbackLessons: Lesson[] = [
  {
    id: "lesson-1",
    content: "Lead with the arrival delay, not departure delay, when claiming EU261 compensation.",
    category: "UK_FLIGHT_DELAY",
    sourceCompany: "Wizz Air",
    outcome: "success",
  },
  {
    id: "lesson-2",
    content: "Private parking appeals win faster when keeper liability defects are cited before mitigation.",
    category: "PARKING_FINE",
    sourceCompany: "Euro Car Parks",
    outcome: "success",
  },
  {
    id: "lesson-3",
    content: "Subscription disputes need a dated cancellation trail before card chargeback escalation.",
    category: "SUBSCRIPTION_CANCELLATION",
    sourceCompany: "StreamBox",
    outcome: "failure",
  },
  {
    id: "lesson-4",
    content: "Delay Repay rejections should quote the operator's published threshold and attach the original ticket.",
    category: "TRAIN_DELAY",
    sourceCompany: "Avanti West Coast",
    outcome: "success",
  },
];
