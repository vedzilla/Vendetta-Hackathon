export function FastForwardIndicator({
  scale = 12000,
  compact = false,
}: {
  scale?: number;
  compact?: boolean;
}) {
  return (
    <span
      className={`mono inline-flex items-center gap-1 border border-[#C03022]/40 text-[#C03022] ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{ animation: "pulse-border 1.2s ease-in-out infinite" }}
    >
      <span aria-hidden>▶▶</span>
      {compact ? "FF" : "FAST FORWARD"} ×{scale}
    </span>
  );
}
