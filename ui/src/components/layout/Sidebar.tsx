import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShieldAlert,
  Gauge,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth, type PermKey } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { verdictService, type ProfileInfo } from "@/services";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: PermKey;
}

const TOP: NavItem = { to: "/", label: "Dashboard & KPIs", icon: LayoutDashboard, perm: "dashboard" };
const BOTTOM: NavItem = { to: "/monitoring", label: "System Monitoring", icon: Gauge, perm: "settings" };

// Group the verdict profiles under sub-headers, like the reports catalog.
const CATEGORY: Record<string, string> = {
  recon: "Reconciliation",
  cross_recon: "Reconciliation",
  file_sequence: "Files",
  record_sequence: "Files",
  file_collection: "Files",
  processing_exception: "Files",
  overview: "Platform",
};
const CATEGORY_ORDER = ["Reconciliation", "Files", "Platform", "Other"];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeProfile = useRouterState({
    select: (s) => (s.location.search as { profile?: string } | undefined)?.profile,
  });
  const { permissions } = useAuth();
  const t = useT();

  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const onVerdicts = pathname.startsWith("/reconciliation");
  const [open, setOpen] = useState(onVerdicts);

  const canDashboard = !!permissions["dashboard"]?.view;
  const canSettings = !!permissions["settings"]?.view;

  useEffect(() => {
    if (canDashboard) verdictService.profiles().then(setProfiles);
  }, [canDashboard]);
  // Auto-expand the catalog whenever we navigate onto the verdicts screen.
  useEffect(() => {
    if (onVerdicts) setOpen(true);
  }, [onVerdicts]);

  const grouped = useMemo(() => {
    const g: Record<string, ProfileInfo[]> = {};
    for (const p of profiles) (g[CATEGORY[p.key] ?? "Other"] ??= []).push(p);
    return g;
  }, [profiles]);

  const selectedProfile = onVerdicts ? (activeProfile ?? profiles[0]?.key) : null;

  const linkClass = (active: boolean) =>
    `group relative flex items-center ${collapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-lg text-sm transition-colors ${
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
    }`;

  const renderPlain = (item: NavItem) => {
    const Icon = item.icon;
    const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
    return (
      <Link key={item.to} to={item.to} title={collapsed ? t(item.label) : undefined} className={linkClass(active)}>
        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
        {!collapsed && <span className="truncate">{t(item.label)}</span>}
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
            {t(item.label)}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out sticky top-0 h-screen self-start z-20 ${
        collapsed ? "w-[72px]" : "w-72"
      }`}
    >
      <div className="px-4 py-5 border-b border-sidebar-border flex items-center gap-3 relative">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-primary flex items-center justify-center shadow-md">
          <svg viewBox="0 0 120 72" className="h-10 w-12" role="img" aria-label="MTN">
            <ellipse cx="60" cy="36" rx="54" ry="29" fill="none" stroke="#000" strokeWidth="7" />
            <text
              x="60"
              y="37"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight="800"
              fontSize="30"
              letterSpacing="-1"
              fill="#000"
            >
              MTN
            </text>
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 transition-opacity">
            <div className="font-semibold tracking-tight text-base leading-none truncate">RADONaix</div>
            <div className="text-xs text-sidebar-foreground/60 mt-1 truncate">{t("Revenue Assurance")}</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-sidebar-border bg-card shadow-sm hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition z-10"
          aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] tracking-widest text-sidebar-foreground/40 font-semibold">{t("MODULES")}</div>
        )}

        {canDashboard && renderPlain(TOP)}

        {/* Fuzzy Verdicts — expandable catalog of report profiles */}
        {canDashboard && collapsed && renderPlain({ to: "/reconciliation", label: "Fuzzy Verdicts", icon: ShieldAlert, perm: "dashboard" })}
        {canDashboard && !collapsed && (
          <div>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className={`group relative w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                onVerdicts
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <ShieldAlert className={`h-4 w-4 shrink-0 ${onVerdicts ? "text-primary" : ""}`} />
                <span className="truncate">{t("Fuzzy Verdicts")}</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className="mt-1 mb-1 ml-4 pl-3 border-l border-sidebar-border space-y-0.5">
                {profiles.length === 0 && (
                  <div className="px-2 py-1.5 text-[13px] text-sidebar-foreground/40">{t("Loading…")}</div>
                )}
                {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
                  <div key={cat}>
                    <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-sidebar-foreground/40">{t(cat)}</div>
                    {grouped[cat].map((p) => {
                      const childActive = selectedProfile === p.key;
                      return (
                        <Link
                          key={p.key}
                          to="/reconciliation"
                          search={{ profile: p.key }}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                            childActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${childActive ? "bg-primary" : "bg-sidebar-foreground/30"}`} />
                          <span className="flex-1 truncate">{t(p.label)}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {canSettings && renderPlain(BOTTOM)}
      </nav>

      <div className={`px-4 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50 ${collapsed ? "text-center" : ""}`}>
        {collapsed ? "v2.4" : "v2.4.1 · Production"}
      </div>
    </aside>
  );
}
