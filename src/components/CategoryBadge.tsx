import type { GrievanceCategory } from "@/types/grievance";
import { categoryLabels } from "./types";

const styles: Record<GrievanceCategory, string> = {
  UK_FLIGHT_DELAY: "border-[#B8954E] text-[#D9BE7B]",
  PARKING_FINE: "border-[#8C8579] text-[#D8D0C2]",
  SUBSCRIPTION_CANCELLATION: "border-[#C03022] text-[#DF6A5F]",
  TRAIN_DELAY: "border-[#7F9A68] text-[#9FB88E]",
};

export function CategoryBadge({ category }: { category: GrievanceCategory }) {
  return (
    <span className={`mono inline-flex rounded-sm border px-2 py-1 text-[10px] uppercase ${styles[category]}`}>
      {categoryLabels[category]}
    </span>
  );
}
