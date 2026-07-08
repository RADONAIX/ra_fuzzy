import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Activity, Cpu, ExternalLink, Gauge } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Tooltip } from "@/components/ui-kit/Tooltip";

export const Route = createFileRoute("/monitoring")({ component: MonitoringPage });

// Grafana is served on the same HTTPS origin behind nginx at /grafana/.
// Override with VITE_GRAFANA_URL if Grafana runs on a different host (e.g. local dev).
const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? "/grafana";

const DASHBOARDS = [
  {
    uid: "radonaix-system",
    title: "System",
    description: "CPU, memory, disk and network for the application server.",
    icon: Cpu,
  },
  {
    uid: "radonaix-api",
    title: "API health",
    description: "Request rate, error rate and latency (p50/p95/p99) for the backend.",
    icon: Activity,
  },
];

function MonitoringPage() {
  const t = useT();
  const [active, setActive] = useState(DASHBOARDS[0].uid);
  const current = DASHBOARDS.find((d) => d.uid === active) ?? DASHBOARDS[0];
  // kiosk hides Grafana's own chrome so it embeds cleanly; refresh every 30s.
  const embedSrc = `${GRAFANA_URL}/d/${current.uid}?kiosk&theme=light&refresh=30s`;

  return (
    <AppShell>
      <PageHeader
        title={t("System Monitoring")}
        description={t("Live system and application health, powered by Prometheus + Grafana — embedded below.")}
        info={t("System and application health metrics, powered by Prometheus and Grafana.")}
        actions={
          <a
            href={`${GRAFANA_URL}/d/${current.uid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Gauge className="h-4 w-4" />
            {t("Open in Grafana")}
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
        }
      />

      {/* Dashboard tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {DASHBOARDS.map((d) => {
          const Icon = d.icon;
          const isActive = d.uid === active;
          return (
            <Tooltip key={d.uid} label={t("View this dashboard")} side="bottom">
              <button
                onClick={() => setActive(d.uid)}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(d.title)}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Embedded Grafana dashboard */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <iframe
          key={current.uid}
          title={`Grafana — ${t(current.title)}`}
          src={embedSrc}
          className="h-[calc(100vh-220px)] min-h-[640px] w-full border-0"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {t(current.description)} {t("Metrics are scraped by Prometheus every 15s from")}{" "}
        <code className="rounded bg-muted px-1 py-0.5">node_exporter</code> {t("(system) and the backend")}{" "}
        <code className="rounded bg-muted px-1 py-0.5">/metrics</code> {t("endpoint (application). If the panel is blank, confirm Grafana is reachable at")}{" "}
        <code className="rounded bg-muted px-1 py-0.5">{GRAFANA_URL}</code>.
      </p>
    </AppShell>
  );
}
