import { cn } from "@/lib/utils";

export function MatchScore({ value, size = 44 }: { value: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color =
    value >= 85
      ? "text-emerald-500"
      : value >= 70
        ? "text-indigo-500"
        : value >= 55
          ? "text-amber-500"
          : "text-rose-500";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth="4"
          className="stroke-muted"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth="4"
          strokeLinecap="round"
          className={cn(color, "transition-all")}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
        />
      </svg>
      <span className={cn("absolute text-[11px] font-semibold", color)}>{value}%</span>
    </div>
  );
}
