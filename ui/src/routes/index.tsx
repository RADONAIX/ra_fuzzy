import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Activity, AlertTriangle, ListChecks, RefreshCw, ShieldAlert, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tooltip } from "@/components/ui-kit/Tooltip";
import { VERDICT_META, VERDICT_ORDER, VerdictBadge, RiskGauge } from "@/components/ui-kit/verdict";
import { useT } from "@/lib/i18n";
import { verdictService, type DashboardSummary, type Verdict } from "@/services";

export const Route = createFileRoute("/")({ component: DashboardPage });

const HOUR_WINDOWS = [24, 48, 168] as const;

function DashboardPage() {
  const t = useT();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [hours, setHours] = useState<number>(48);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setAuthed(!!sessionStorage.getItem("radonaix_token"));
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setLoading(true);
    verdictService
      .summary(hours)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authed, hours, tick]);

  if (authed === null) return null;
  if (!authed) return <Navigate to="/login" />;

  const total = summary?.bucketsMonitored ?? 0;

  return (
    <AppShell>
      <PageHeader
        title={t("Dashboard & KPIs")}
        description={t("Live revenue-assurance health across every report, from the IT2 + CWW verdict engine.")}
        info={t("A roll-up of the fuzzy verdicts: platform health now, what's flagged, and what needs attention.")}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              {HOUR_WINDOWS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    hours === h ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {h === 168 ? t("7d") : `${h}h`}
                </button>
              ))}
            </div>
            <Tooltip label={t("Refresh")} side="bottom">
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

      {loading && !summary ? (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-20 text-sm text-muted-foreground">
          <Activity className="h-4 w-4 animate-pulse" />
          {t("Computing platform health…")}
        </div>
      ) : !summary || total === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-20 text-center text-sm text-muted-foreground">
          {t("No verdict data for this window.")}
        </div>
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {/* Platform health + gauge */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t("Platform health (now)")}</span>
                <VerdictBadge verdict={summary.platformVerdict} />
              </div>
              <div className="mt-3">
                <RiskGauge score={summary.platformScore} lo={summary.platformBandLo} hi={summary.platformBandHi} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {t("score")} <span className="font-medium text-foreground tabular-nums">{summary.platformScore.toFixed(1)}</span>{" "}
                {t("band")} {summary.platformBandLo.toFixed(0)}–{summary.platformBandHi.toFixed(0)}
              </div>
            </div>

            <Kpi label={t("Hours monitored")} value={total} sub={t("bucket-verdicts")} />
            <Kpi
              label={t("Flagged for review")}
              value={`${summary.flaggedPct.toFixed(1)}%`}
              sub={t("Watch or worse")}
              tone={summary.flaggedPct > 5 ? "warn" : undefined}
            />
            <Kpi
              label={t("Critical")}
              value={summary.counts.Critical ?? 0}
              sub={t("hours")}
              tone={(summary.counts.Critical ?? 0) > 0 ? "crit" : undefined}
            />
          </div>

          {/* Verdict distribution strip */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VERDICT_ORDER.map((v) => {
              const m = VERDICT_META[v];
              const n = summary.counts[v] ?? 0;
              return (
                <div key={v} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                    <span className="text-sm font-medium text-muted-foreground">{t(m.label)}</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{n}</div>
                  <div className="text-xs text-muted-foreground">
                    {total ? `${((n / total) * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Per-report health */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">{t("Report health")}</h3>
              </div>
              <div className="divide-y divide-border/60">
                {summary.reports
                  .slice()
                  .sort((a, b) => VERDICT_META[b.worstVerdict].order - VERDICT_META[a.worstVerdict].order || b.worstScore - a.worstScore)
                  .map((r) => (
                    <Link
                      key={r.profile}
                      to="/reconciliation"
                      search={{ profile: r.profile }}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{t(r.label)}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {(["Critical", "Suspect", "Watch"] as Verdict[])
                            .filter((v) => (r.counts[v] ?? 0) > 0)
                            .map((v) => `${r.counts[v]} ${v}`)
                            .join(" · ") || t("all healthy")}
                        </div>
                      </div>
                      <VerdictBadge verdict={r.worstVerdict} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
              </div>
            </div>

            {/* Needs attention now */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">{t("Needs attention")}</h3>
                <span className="ml-auto text-xs text-muted-foreground">{summary.attention.length} {t("items")}</span>
              </div>
              {summary.attention.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {t("Nothing above Watch — all clear.")}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {summary.attention.map((a) => (
                    <Link
                      key={`${a.profile}|${a.entity}|${a.hour}`}
                      to="/reconciliation"
                      search={{ profile: a.profile }}
                      className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-muted/40"
                    >
                      <VerdictBadge verdict={a.verdict} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">
                          <span className="font-medium">{a.entity}</span>
                          <span className="text-muted-foreground"> · {t(a.label)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{format(new Date(a.hour), "MMM d, HH:00")}</div>
                      </div>
                      <span className="tabular-nums text-sm font-medium text-foreground">{a.score.toFixed(1)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            {t("Verdicts are triage — they rank attention, not root cause. Open a report to see the rule trace.")}
          </p>
        </>
      )}
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly sub?: string;
  readonly tone?: "warn" | "crit";
}) {
  const valueTone = tone === "crit" ? "text-red-600 dark:text-red-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${valueTone}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default DashboardPage;
