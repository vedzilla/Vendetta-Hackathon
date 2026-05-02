/**
 * Per-vertical config. Only UK_FLIGHT_DELAY runs live workflows in v1; the
 * other categories exist as static seeded campaigns (see seeded-campaigns.ts).
 */

import type { GrievanceCategory } from "./grievance";

export interface VerticalConfig {
  id: GrievanceCategory;
  /** Human-readable label for the dashboard. */
  label: string;
  /** Whether this vertical actually runs the durable workflow. */
  liveExecution: boolean;
  /** Default response window before escalation triggers. */
  defaultDeadlineDays: number;
  /** Currency of compensation claims in this vertical. */
  defaultCurrency: string;
  /** Regulator name (used for escalation copy). */
  regulator?: string;
  regulatorUrl?: string;
  /** Statute citations the agent should anchor on. */
  primaryStatutes: string[];
  /**
   * Mubit seed lessons — written into memory at boot so getContext() has real
   * material from day one.
   */
  seedLessons: string[];
}

export interface UkFlightDelayFacts {
  flightNumber?: string;
  origin?: string;
  destination?: string;
  scheduledDeparture?: string;
  actualArrival?: string;
  delayHours?: number;
  /** Distance in kilometres — drives the compensation tier. */
  distanceKm?: number;
  /** Whether the airline cited extraordinary circumstances. */
  airlineCitedExtraordinary?: boolean;
}

export const UK_FLIGHT_DELAY: VerticalConfig = {
  id: "UK_FLIGHT_DELAY",
  label: "UK / EU flight delay",
  liveExecution: true,
  defaultDeadlineDays: 14,
  defaultCurrency: "GBP",
  regulator: "UK Civil Aviation Authority (PACT)",
  regulatorUrl: "https://www.caa.co.uk/passengers/resolving-travel-problems/",
  primaryStatutes: [
    "EC 261/2004 Article 7(1)(a)",
    "EC 261/2004 Article 7(1)(b)",
    "EC 261/2004 Article 7(1)(c)",
    "EC 261/2004 Article 7(3)",
    "EC 261/2004 Article 9",
    "Air Passenger Rights and Compensation Regulations 2019 (UK261)",
  ],
  seedLessons: [
    "Wizz Air typically responds to EU261 claims within 9–11 days when Article 7 is cited explicitly in the first paragraph and the booking reference is in the subject line.",
    "easyJet's first response is consistently a £50 voucher; cite Article 7(3) on form of payment to upgrade to cash entitlement.",
    "Ryanair frequently cites 'ATC extraordinary circumstances' without specific NOTAM evidence; demand the NOTAM reference.",
    "British Airways accepts EU261 claims faster when the second escalation letter is addressed to the Customer Care Director found via LinkedIn.",
    "The UK CAA's PACT submission requires airline final response in writing AND proof of 8 weeks elapsed since first complaint.",
    "Compensation liability sits with the OPERATING carrier, not the marketing one — clarify this for codeshare disputes.",
  ],
};

export const PARKING_FINE: VerticalConfig = {
  id: "PARKING_FINE",
  label: "Parking fine",
  liveExecution: false,
  defaultDeadlineDays: 28,
  defaultCurrency: "GBP",
  regulator: "POPLA / IAS",
  primaryStatutes: ["Protection of Freedoms Act 2012, Schedule 4"],
  seedLessons: [
    "Private parking operators must follow the British Parking Association code; signage that doesn't meet the minimum-size requirement renders the contract unenforceable.",
    "POPLA appeals are free and overturn ~50% of contested PCNs when signage evidence is challenged.",
  ],
};

export const SUBSCRIPTION_CANCELLATION: VerticalConfig = {
  id: "SUBSCRIPTION_CANCELLATION",
  label: "Subscription cancellation",
  liveExecution: false,
  defaultDeadlineDays: 30,
  defaultCurrency: "GBP",
  regulator: "Competition and Markets Authority (CMA)",
  primaryStatutes: [
    "Consumer Rights Act 2015, Part 1, Chapter 4",
    "Consumer Contracts Regulations 2013, Regulation 36",
  ],
  seedLessons: [
    "Companies must process cancellation requests within 14 days of receipt; failure entitles the consumer to a refund of payments taken in that window.",
    "Citing CMA Pricing Practices Guide alongside Section 50 CRA reliably escalates subscription disputes to the chargeback stage.",
  ],
};

export const TRAIN_DELAY: VerticalConfig = {
  id: "TRAIN_DELAY",
  label: "UK train delay (Delay Repay)",
  liveExecution: false,
  defaultDeadlineDays: 28,
  defaultCurrency: "GBP",
  regulator: "Rail Ombudsman",
  primaryStatutes: ["National Rail Conditions of Travel"],
  seedLessons: [
    "Delay Repay 15 schemes (most TOCs) pay 25% for 15-29 min, 50% for 30-59 min, 100% for 60+ min delays.",
    "Operators must process Delay Repay claims within 20 working days; escalate to the Rail Ombudsman after 40 days of inaction.",
  ],
};

export const VERTICALS: Record<GrievanceCategory, VerticalConfig> = {
  UK_FLIGHT_DELAY,
  PARKING_FINE,
  SUBSCRIPTION_CANCELLATION,
  TRAIN_DELAY,
};

export function verticalFor(category: GrievanceCategory): VerticalConfig {
  return VERTICALS[category];
}
