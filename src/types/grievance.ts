/**
 * The canonical Grievance record. Source of truth for the dashboard,
 * the workflow, the Telegram bot, and the Resend webhook.
 *
 * KV key: `grievance:{id}` (JSON), append-only timeline at
 * `grievance:{id}:timeline` (LPUSH list of TimelineEvent).
 */

export type GrievanceCategory =
  | "UK_FLIGHT_DELAY"
  | "PARKING_FINE"
  | "SUBSCRIPTION_CANCELLATION"
  | "TRAIN_DELAY";

export type GrievanceStatus =
  | "INTAKE"
  | "CLASSIFIED"
  | "RESEARCHING"
  | "AWAITING_APPROVAL"
  | "AWAITING_REPLY"
  | "NEGOTIATING"
  | "ESCALATED"
  | "WON"
  | "LOST"
  | "CANCELLED";

export type TimelineEventKind =
  | "received"
  | "classified"
  | "researched"
  | "drafted"
  | "approval_requested"
  | "approved"
  | "edited"
  | "cancelled"
  | "sent"
  | "reply_received"
  | "negotiating"
  | "escalated"
  | "lesson_learned"
  | "won"
  | "lost";

export interface TimelineEvent {
  at: string;
  kind: TimelineEventKind;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface GrievanceFacts {
  company?: string;
  incidentDate?: string;
  referenceNumber?: string;
  amountClaimed?: number;
  currency?: string;
  // Vertical-specific extensions live here. Keep open-ended.
  [key: string]: unknown;
}

export interface GrievanceResearch {
  complaintsAddress?: string;
  regulatorName?: string;
  regulatorUrl?: string;
  executiveContact?: {
    name: string;
    role: string;
    linkedinUrl: string;
  };
  relevantStatutes?: string[];
  typicalResponseDays?: number;
}

export interface GrievanceNotifyVia {
  telegram?: { chatId: string };
  email?: string;
}

export interface GrievanceMetadata {
  demoMode?: boolean;
  scenario?: "easy_win" | "negotiation" | "escalation";
  /**
   * Marks seeded multi-vertical fakes — present in the dashboard for
   * platform-credibility but never trigger live workflows.
   */
  seeded?: boolean;
}

export interface Grievance {
  id: string;
  userId: string;
  category: GrievanceCategory;
  status: GrievanceStatus;
  rawDescription: string;

  facts: GrievanceFacts;
  research?: GrievanceResearch;
  timeline: TimelineEvent[];

  notifyVia: GrievanceNotifyVia;
  workflowRunId?: string;
  simulationRunId?: string;

  metadata?: GrievanceMetadata;

  createdAt: string;
  updatedAt: string;
}

/** POST /api/grievances request body. */
export interface CreateGrievanceInput {
  description: string;
  notifyVia: GrievanceNotifyVia;
  facts?: GrievanceFacts;
  category?: GrievanceCategory;
  metadata?: GrievanceMetadata;
}

/** POST /api/grievances/:id/approve request body. */
export type ApprovalAction =
  | { action: "approve" }
  | { action: "edit"; edits: string }
  | { action: "cancel" };

/** Inbound reply payload — same shape for real Resend and demo simulator. */
export interface InboundReply {
  grievanceId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export type ReplyClassification =
  | "ACCEPTANCE"
  | "PARTIAL_OFFER"
  | "REJECTION"
  | "REQUEST_FOR_INFO"
  | "OTHER";

export interface ClassifiedReply {
  kind: ReplyClassification;
  /** Cash amount offered (in the grievance's currency), if any. */
  offerAmount?: number;
  /** Free-form summary surfaced on the dashboard timeline. */
  summary: string;
}
