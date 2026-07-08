import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tooltip } from "@/components/ui-kit/Tooltip";
import { useT } from "@/lib/i18n";
import { reconVerdictService, type Verdict, type VerdictRow } from "@/services";

export const Route = createFileRoute("/reconciliation")({ component: ReconciliationPage });

// Four-state verdict palette. Explicit colours (not the 3 semantic tokens) so
// Healthy / Watch / Suspect / Critical each read distinctly in light + dark.
const VERDICT_META: Record<Verdict, { label: string; badge: string; dot: string; order: number }> = {
  Healthy: {
    label: "Healthy",
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    dot: "bg-emerald-500",
    order: 0,
  },
  Watch: {
    label: "Watch",
    badge:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    dot: "bg-amber-500",
    order: 1,
  },
  Suspect: {
    label: "Suspect",
    badge:
      "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900",
    dot: "bg-orange-500",
    order: 2,
  },
  Critical: {
    label: "Critical",
    badge:
      "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
    dot: "bg-red-500",
    order: 3,
  },
};

const VERDICT_ORDER: Verdict[] = ["Healthy", "Watch", "Suspect", "Critical"];
const HOUR_WINDOWS = [24, 48, 168] as const;

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const m = VERDICT_META[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function pct(v: number) {
  return `${v.toFixed(2)}%`;
}

function ReconciliationPage() {
  const t = useT();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [hours, setHours] = useState<number>(48);
  const [rows, setRows] = useState<VerdictRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setAuthed(!!sessionStorage.getItem("radonaix_token"));
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    reconVerdictService
      .list(hours)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load verdicts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authed, hours, tick]);

  // Most-severe first — that's the triage order analysts want.
  const sorted = useMemo(
    () =>
      (rows ?? [])
        .slice()
        .sort(
          (a, b) =>
            VERDICT_META[b.verdict].order - VERDICT_META[a.verdict].order ||
            b.score - a.score ||
            a.hour.localeCompare(b.hour),
        ),
    [rows],
  );

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { Healthy: 0, Watch: 0, Suspect: 0, Critical: 0 };
    for (const r of rows ?? []) c[r.verdict] += 1;
    return c;
  }, [rows]);

  if (authed === null) return null;
  if (!authed) return <Navigate to="/login" />;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <AppShell>
      <PageHeader
        title={t("Reconciliation Verdicts")}
        description={t(
          "Hourly Interval Type-2 fuzzy + Computing-With-Words triage over the raw vs mediation feed. Catch-up is treated as latency, not leakage.",
        )}
        info={t(
          "Each (record type, hour) bucket is classified Healthy / Watch / Suspect / Critical with an uncertainty band and an IF/THEN rule trace.",
        )}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              {HOUR_WINDOWS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    hours === h
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {h === 168 ? t("7d") : `${h}h`}
                </button>
              ))}
            </div>
            <Tooltip label={t("Recompute verdicts")} side="bottom">
              <button
                onClick={() => setTick((k) => k + 1)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {t("Refresh")}
              </button>
            </Tooltip>
          </div>
        }
      />

      {/* Verdict distribution strip — the signature element */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VERDICT_ORDER.map((v) => {
          const m = VERDICT_META[v];
          return (
            <div key={v} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                <span className="text-sm font-medium text-muted-foreground">{t(m.label)}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {counts[v]}
              </div>
              <div className="text-xs text-muted-foreground">{t("hour buckets")}</div>
            </div>
          );
        })}
      </div>

      {/* Verdicts table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" />
            {t("Hourly verdicts")}
          </h3>
          <span className="text-xs text-muted-foreground">
            {sorted.length} {t("buckets")} · {hours === 168 ? t("last 7 days") : `${t("last")} ${hours}h`}
          </span>
        </div>

        {loading && !rows ? (
          <div className="flex items-center justify-center gap-3 px-5 py-16 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            {t("Computing verdicts…")}
          </div>
        ) : error ? (
          <div className="px-5 py-16 text-center text-sm text-destructive">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            {t(
              "No verdicts for this window. Confirm ClickHouse is reachable and the stream has records in range.",
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5 font-medium">{t("Verdict")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("Record type")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("Hour (UTC)")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Score")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Count gap")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Value gap")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Catch-up")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Dup")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Mismatch")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Traffic")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const key = `${r.recordType}|${r.hour}`;
                  const isOpen = expanded.has(key);
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => toggle(key)}
                        className="cursor-pointer border-b border-border/60 hover:bg-muted/40"
                      >
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <VerdictBadge verdict={r.verdict} />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground">{r.recordType}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {format(new Date(r.hour), "MMM d, HH:00")}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">
                          {r.score.toFixed(1)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({r.bandLo.toFixed(0)}–{r.bandHi.toFixed(0)})
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct(r.countGapPct)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct(r.valueGapPct)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct(r.catchupRatePct)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct(r.dupRatePct)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct(r.mismatchRatePct)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct(r.trafficPct)}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b border-border/60 bg-muted/20">
                          <td />
                          <td colSpan={10} className="px-3 py-3">
                            <div className="grid gap-4 md:grid-cols-2">
                              {/* Rule trace — the explainability */}
                              <div>
                                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {t("Why this verdict — rule trace")}
                                </div>
                                {r.drivers.length === 0 ? (
                                  <div className="text-xs text-muted-foreground">
                                    {t("No rules fired (baseline clean).")}
                                  </div>
                                ) : (
                                  <ul className="space-y-1">
                                    {r.drivers.map((d, i) => (
                                      <li key={i} className="flex items-center gap-2 text-xs">
                                        <span className="font-mono text-foreground">
                                          IF {d.rule} → {d.consequent}
                                        </span>
                                        <span className="text-muted-foreground">
                                          [{d.firingLo.toFixed(2)}, {d.firingHi.toFixed(2)}]
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              {/* Raw vector */}
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                <Stat label={t("Raw / Proc")} value={`${r.rawCount} / ${r.procCount}`} />
                                <Stat label={t("Matched")} value={r.matched} />
                                <Stat label={t("Catch-up / Raw-only")} value={`${r.catchup} / ${r.rawOnly}`} />
                                <Stat label={t("Proc-only (ghost)")} value={r.procOnly} />
                                <Stat label={t("Duplicates")} value={r.dupCount} />
                                <Stat label={t("Amount mismatch")} value={r.amtMismatch} />
                                <Stat label={t("Similarity")} value={r.similarity.toFixed(3)} />
                                <Stat label={t("Band")} value={`${r.bandLo.toFixed(1)} – ${r.bandHi.toFixed(1)}`} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {t(
          "Verdicts are triage — they rank attention, they don't replace root-cause investigation or drive billing decisions.",
        )}
      </p>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium text-foreground">{value}</span>
    </div>
  );
}

export default ReconciliationPage;
