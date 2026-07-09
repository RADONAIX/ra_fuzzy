import type { Verdict } from "@/services";

// Four-state verdict palette + a fixed hex per verdict for gauges/charts.
// Distinct in light + dark; deliberately clear of the teal brand primary.
export const VERDICT_META: Record<
  Verdict,
  { label: string; badge: string; dot: string; hex: string; order: number }
> = {
  Healthy: {
    label: "Healthy",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    dot: "bg-emerald-500",
    hex: "#10b981",
    order: 0,
  },
  Watch: {
    label: "Watch",
    badge: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    dot: "bg-amber-500",
    hex: "#f59e0b",
    order: 1,
  },
  Suspect: {
    label: "Suspect",
    badge: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900",
    dot: "bg-orange-500",
    hex: "#f97316",
    order: 2,
  },
  Critical: {
    label: "Critical",
    badge: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
    dot: "bg-red-500",
    hex: "#ef4444",
    order: 3,
  },
};

export const VERDICT_ORDER: Verdict[] = ["Healthy", "Watch", "Suspect", "Critical"];

export function VerdictBadge({ verdict }: { readonly verdict: Verdict }) {
  const m = VERDICT_META[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// 0–100 risk gauge with the IT2 type-reduced interval drawn as a band
// (revived from the original MVP dashboard).
export function RiskGauge({ score, lo, hi }: { readonly score: number; readonly lo: number; readonly hi: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full"
      style={{
        background:
          "linear-gradient(90deg,#10b981 0%,#10b981 25%,#f59e0b 25%,#f59e0b 50%,#f97316 50%,#f97316 76%,#ef4444 76%,#ef4444 100%)",
      }}
    >
      {/* uncertainty band */}
      <div
        className="absolute top-0 h-full bg-foreground/30"
        style={{ left: `${clamp(lo)}%`, width: `${Math.max(clamp(hi) - clamp(lo), 1)}%` }}
      />
      {/* score marker */}
      <div className="absolute -top-0.5 h-[calc(100%+4px)] w-0.5 bg-foreground" style={{ left: `${clamp(score)}%` }} />
    </div>
  );
}
