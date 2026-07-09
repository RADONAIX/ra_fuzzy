import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ShieldAlert, RefreshCw, ChevronDown, ChevronRight, Activity, Gauge } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tooltip } from "@/components/ui-kit/Tooltip";
import { VERDICT_META, VERDICT_ORDER, VerdictBadge } from "@/components/ui-kit/verdict";
import { useT } from "@/lib/i18n";
import {
  verdictService,
  type BenchmarkMetrics,
  type BenchmarkReport,
  type ProfileInfo,
  type ProfileVerdictRow,
  type Verdict,
} from "@/services";

type VerdictsSearch = { profile?: string };

export const Route = createFileRoute("/reconciliation")({
  // The selected report is a URL param, set from the sidebar.
  validateSearch: (search: Record<string, unknown>): VerdictsSearch => ({
    profile: typeof search.profile === "string" ? search.profile : undefined,
  }),
  component: VerdictsPage,
});

const HOUR_WINDOWS = [24, 48, 168] as const;

// Header carries the unit (e.g. "Count gap %"), so the cell shows the number.
function fmtMetric(label: string, v: number) {
  if (label.includes("%")) return v.toFixed(2);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function MetricCard({ title, m, accent }: { readonly title: string; readonly m: BenchmarkMetrics; readonly accent?: boolean }) {
  const rows: [string, string][] = [
    ["F1", m.f1.toFixed(3)],
    ["Precision", m.precision.toFixed(3)],
    ["Recall", m.recall.toFixed(3)],
    ["False-alarm", m.falseAlarmRate.toFixed(3)],
  ];
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <div className="mb-2 text-xs font-medium text-foreground">{title}</div>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{k}</span>
            <span className="tabular-nums font-medium text-foreground">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerdictsPage() {
  const t = useT();
  const { profile: profileParam } = Route.useSearch();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [hours, setHours] = useState<number>(48);
  const [rows, setRows] = useState<ProfileVerdictRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [benchmark, setBenchmark] = useState<BenchmarkReport | null>(null);

  useEffect(() => {
    setAuthed(!!sessionStorage.getItem("radonaix_token"));
  }, []);

  // Load the available report profiles once.
  useEffect(() => {
    if (!authed) return;
    verdictService.profiles().then(setProfiles);
  }, [authed]);

  // The selected report comes from the URL (?profile=, set from the sidebar);
  // fall back to the first profile once the list loads.
  const profileKey = profileParam ?? profiles[0]?.key ?? "";
  const profile = useMemo(
    () => profiles.find((p) => p.key === profileKey),
    [profiles, profileKey],
  );

  // Load the fuzzy-vs-baseline benchmark for the selected profile (null if none).
  useEffect(() => {
    if (!authed || !profileKey) {
      setBenchmark(null);
      return;
    }
    let cancelled = false;
    verdictService.benchmark(profileKey).then((b) => {
      if (!cancelled) setBenchmark(b);
    });
    return () => {
      cancelled = true;
    };
  }, [authed, profileKey]);

  // Load verdicts for the selected profile + window.
  useEffect(() => {
    if (!authed || !profileKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    verdictService
      .list(profileKey, hours)
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
  }, [authed, profileKey, hours, tick]);

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

  const metricCols = profile?.metrics ?? [];
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <AppShell>
      <PageHeader
        title={profile ? `${t("Fuzzy Verdicts")} — ${t(profile.label)}` : t("Fuzzy Verdicts")}
        description={t(
          "Hourly Interval Type-2 fuzzy + Computing-With-Words triage per report. Catch-up / lateness is treated as latency, not loss.",
        )}
        info={t(
          "Each report is classified Healthy / Watch / Suspect / Critical per entity and hour, with an uncertainty band and an IF/THEN rule trace.",
        )}
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

      {/* Benchmark: fuzzy vs crisp baseline (evidence the fuzzy layer earns its place) */}
      {profile?.hasBenchmark && benchmark && (
        <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-primary" />
            {t("Fuzzy vs. baseline")}
            <span className="text-xs font-normal text-muted-foreground">
              {t("labelled set")}, n={benchmark.sampleSize}
            </span>
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard title={t("Fuzzy (IT2 + CWW)")} m={benchmark.fuzzy} accent />
            <MetricCard title={`${t("Baseline")} — ${benchmark.baselineName}`} m={benchmark.baseline} />
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-medium text-muted-foreground">{t("Catch-up false alarms")}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {benchmark.latencyFalseAlarms.fuzzy}
                </span>
                <span className="text-sm text-muted-foreground">/ {benchmark.latencyFalseAlarms.total} {t("fuzzy")}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {benchmark.latencyFalseAlarms.baseline}
                </span>
                <span className="text-sm text-muted-foreground">/ {benchmark.latencyFalseAlarms.total} {t("baseline")}</span>
              </div>
              <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                {t("Caught-up hours wrongly flagged. Fuzzy discounts latency; a threshold can't.")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verdict distribution strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VERDICT_ORDER.map((v) => {
          const m = VERDICT_META[v];
          return (
            <div key={v} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                <span className="text-sm font-medium text-muted-foreground">{t(m.label)}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{counts[v]}</div>
              <div className="text-xs text-muted-foreground">{t("buckets")}</div>
            </div>
          );
        })}
      </div>

      {/* Verdicts table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" />
            {profile ? t(profile.label) : t("Verdicts")}
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
            {t("No verdicts for this window.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5 font-medium">{t("Verdict")}</th>
                  <th className="px-3 py-2.5 font-medium">{t(profile?.entityLabel ?? "Entity")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("Hour (UTC)")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("Score")}</th>
                  {metricCols.map((mc) => (
                    <th key={mc.key} className="px-3 py-2.5 text-right font-medium">
                      {t(mc.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const key = `${r.entity}|${r.hour}`;
                  const isOpen = expanded.has(key);
                  return (
                    <Fragment key={key}>
                      <tr onClick={() => toggle(key)} className="cursor-pointer border-b border-border/60 hover:bg-muted/40">
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-3 py-2.5">
                          <VerdictBadge verdict={r.verdict} />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground">{r.entity}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{format(new Date(r.hour), "MMM d, HH:00")}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">
                          {r.score.toFixed(1)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({r.bandLo.toFixed(0)}–{r.bandHi.toFixed(0)})
                          </span>
                        </td>
                        {metricCols.map((mc) => (
                          <td key={mc.key} className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {fmtMetric(mc.label, r.metrics[mc.key] ?? 0)}
                          </td>
                        ))}
                      </tr>

                      {isOpen && (
                        <tr className="border-b border-border/60 bg-muted/20">
                          <td />
                          <td colSpan={4 + metricCols.length} className="px-3 py-3">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {t("Why this verdict — rule trace")}
                                </div>
                                {r.drivers.length === 0 ? (
                                  <div className="text-xs text-muted-foreground">{t("No rules fired (baseline clean).")}</div>
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
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                {Object.entries(r.context).map(([k, v]) => (
                                  <div key={k} className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                                    <span className="tabular-nums font-medium text-foreground">
                                      {Number.isInteger(v) ? v : v.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">{t("similarity")}</span>
                                  <span className="tabular-nums font-medium text-foreground">{r.similarity.toFixed(3)}</span>
                                </div>
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
        {t("Verdicts are triage — they rank attention, they don't replace root-cause investigation or drive billing decisions.")}
      </p>
    </AppShell>
  );
}

export default VerdictsPage;
