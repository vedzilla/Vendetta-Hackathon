/**
 * The three scripted demo scenarios. The simulated airline reply text is
 * canonical per docs/09_DEMO_MODE.md — do not rewrite once filled in.
 *
 * `beats` are the synthetic inbound replies a fake airline will send. The
 * simulate-replies workflow walks them in order, sleeping `afterDelay`
 * (scaled by demoScale) before posting each one to the real Resend
 * inbound webhook. The pursuit workflow has no idea they're synthetic.
 */

import type { GrievanceFacts } from "@/types/grievance";

export type ScenarioKey = "easy_win" | "negotiation" | "escalation";

export interface ReplyBeat {
  /** Real-world delay before this beat fires; scaled by demoSleep. */
  afterDelay: string;
  from: string;
  subject: string;
  body: string;
}

export interface DemoScenario {
  voiceNoteText: string;
  preExtractedFacts: GrievanceFacts;
  estimatedSeconds: number;
  beats: ReplyBeat[];
}

const SCENARIOS: Record<ScenarioKey, DemoScenario> = {
  easy_win: {
    voiceNoteText:
      "Wizz Air delayed my flight from Luton to Budapest by four hours yesterday, " +
      "the first of May, booking reference W6-9XYZ. I want compensation.",
    preExtractedFacts: {
      company: "Wizz Air",
      incidentDate: "2026-05-01",
      referenceNumber: "W6-9XYZ",
      amountClaimed: 220,
      currency: "GBP",
    },
    estimatedSeconds: 25,
    beats: [
      {
        afterDelay: "10 days",
        from: "customercare@wizzair.com",
        subject: "Re: Compensation claim — W6-9XYZ — 2026-05-01",
        body:
          "Dear Passenger,\n\n" +
          "Thank you for contacting Wizz Air Customer Care regarding flight W6-9XYZ on " +
          "1 May 2026. Following our review, we confirm the delay was within our operational " +
          "control. We have authorised payment of EU261/UK261 compensation in the amount " +
          "of £220 to your original payment method, processed within 7-10 business days.\n\n" +
          "Reference: WCC-2026-19284\n\n" +
          "Wizz Air Customer Care Team",
      },
    ],
  },

  negotiation: {
    voiceNoteText:
      "easyJet delayed my flight EZY1234 from Gatwick to Barcelona by three and a half hours " +
      "on the twenty-eighth of April, booking reference EZ8K2P3. I want what I'm owed.",
    preExtractedFacts: {
      company: "easyJet",
      incidentDate: "2026-04-28",
      referenceNumber: "EZ8K2P3",
      amountClaimed: 350,
      currency: "GBP",
    },
    estimatedSeconds: 50,
    beats: [
      {
        afterDelay: "8 days",
        from: "claims@easyjet.com",
        subject: "Re: Your claim EZ8K2P3 — case 2026-44721",
        body:
          "Dear Customer,\n\n" +
          "We acknowledge receipt of your complaint regarding flight EZY1234 on 28 April 2026. " +
          "As a goodwill gesture, easyJet is pleased to offer you a £50 voucher redeemable " +
          "against any future easyJet booking, valid for 12 months from the date of issue. " +
          "Please reply to this email within 14 days to accept this offer.\n\n" +
          "Customer Service\n" +
          "easyJet UK",
      },
      {
        afterDelay: "8 days",
        from: "claims@easyjet.com",
        subject: "Re: Your claim EZ8K2P3 — case 2026-44721 (revised)",
        body:
          "Dear Customer,\n\n" +
          "Following your reference to Article 7(3) of EC 261/2004 regarding the form of " +
          "compensation, we will process the full UK261 compensation amount of £350 to your " +
          "original payment method within 14 business days. The voucher offer is hereby " +
          "withdrawn.\n\n" +
          "Customer Service\n" +
          "easyJet UK",
      },
    ],
  },

  escalation: {
    voiceNoteText:
      "Ryanair delayed my flight FR8821 from Stansted to Krakow by five hours, " +
      "no compensation offered, booking reference RY3K8H. The delay was their fault, not weather.",
    preExtractedFacts: {
      company: "Ryanair",
      incidentDate: "2026-04-25",
      referenceNumber: "RY3K8H",
      amountClaimed: 220,
      currency: "GBP",
    },
    estimatedSeconds: 80,
    beats: [
      {
        afterDelay: "8 days",
        from: "customer.relations@ryanair.com",
        subject: "Re: Your enquiry — RY3K8H",
        body:
          "Dear Passenger,\n\n" +
          "We regret that the delay to your flight FR8821 was caused by extraordinary " +
          "circumstances beyond our control, specifically air traffic control restrictions " +
          "at the destination airport. As such, EC 261/2004 compensation is not payable " +
          "in this instance. We apologise for the inconvenience caused.\n\n" +
          "Ryanair Customer Service",
      },
      {
        afterDelay: "7 days",
        from: "customer.relations@ryanair.com",
        subject: "Re: Your enquiry — RY3K8H (final)",
        body:
          "Dear Passenger,\n\n" +
          "We are unable to provide the specific NOTAM reference you have requested. " +
          "Our position remains unchanged. This is our final response on this matter.\n\n" +
          "Ryanair Customer Service",
      },
      {
        afterDelay: "10 days",
        from: "decisions@aviationadr.org.uk",
        subject: "Adjudication decision — RY3K8H — Case AADR-26-8472",
        body:
          "Dear Complainant,\n\n" +
          "Following our review of your case file (AADR-26-8472), and the airline's failure " +
          "to substantiate its claim of extraordinary circumstances with the documented NOTAM " +
          "evidence requested, we find in your favour. Ryanair is hereby directed to pay the " +
          "full UK261 compensation amount of £220 plus statutory interest within 14 days of " +
          "this decision.\n\n" +
          "AviationADR Adjudication Service",
      },
    ],
  },
};

export function getScenarios(): Record<ScenarioKey, DemoScenario> {
  return SCENARIOS;
}

export function getScenario(key: ScenarioKey): DemoScenario {
  const scenario = SCENARIOS[key];
  if (!scenario) {
    throw new Error(`Unknown demo scenario: ${key}`);
  }
  return scenario;
}
