import type { GrievanceStatus } from "@/types/grievance";
import { statusLabels } from "./types";

const styles: Record<GrievanceStatus, string> = {
  INTAKE: "border-[#8C8579] text-[#D8D0C2]",
  CLASSIFIED: "border-[#B8954E] text-[#D9BE7B]",
  RESEARCHING: "border-[#B8954E] text-[#B8954E]",
  AWAITING_APPROVAL: "border-[#D8D0C2] text-[#F2EBDC]",
  AWAITING_REPLY: "border-[#C03022] text-[#DF6A5F]",
  NEGOTIATING: "border-[#B8954E] text-[#D9BE7B]",
  ESCALATED: "border-[#C03022] text-[#C03022]",
  WON: "border-[#7F9A68] text-[#9FB88E]",
  LOST: "border-[#8C8579] text-[#8C8579]",
  CANCELLED: "border-[#5C554A] text-[#8C8579]",
};

export function StatusPill({ status }: { status: GrievanceStatus }) {
  return (
    <span
      className={`mono inline-flex items-center rounded-full border px-2 py-1 text-[10px] uppercase tracking-normal transition-colors duration-300 ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
