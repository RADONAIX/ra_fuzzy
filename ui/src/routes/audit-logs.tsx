import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { auditService } from "@/services";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/audit-logs")({ component: AuditPage });

function AuditPage() {
  const t = useT();
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { auditService.list().then(setLogs); }, []);
  return (
    <AppShell>
      <PageHeader title={t("Audit Logs")} description={t("Immutable trail of operator and system actions.")} info={t("An immutable record of every operator and system action.")} />
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{["Event ID", "Actor", "Action", "Target", "When"].map((h) => (
              <th key={h} className="text-left font-medium px-4 py-3">{t(h)}</th>
            ))}</tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">{l.id}</td>
                <td className="px-4 py-3 text-foreground/80">{l.actor}</td>
                <td className="px-4 py-3 text-foreground/80">{l.action}</td>
                <td className="px-4 py-3 text-foreground/80">{l.target}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(l.at).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">{t("No data found")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
