import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShieldAlert,
  Gauge,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth, type PermKey } from "@/lib/auth";
import { useT } from "@/lib/i18n";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge: number | null;
  perm: PermKey;
}

const items: NavItem[] = [
  { to: "/", label: "Dashboard & KPIs", icon: LayoutDashboard, badge: null, perm: "dashboard" },
  { to: "/reconciliation", label: "Fuzzy Verdicts", icon: ShieldAlert, badge: null, perm: "dashboard" },
  { to: "/monitoring", label: "System Monitoring", icon: Gauge, badge: null, perm: "settings" },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { permissions } = useAuth();
  const t = useT();
  const visible = items.filter((i) => permissions[i.perm]?.view);

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
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));

          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? t(item.label) : undefined}
              className={`group relative flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <span className={`flex items-center ${collapsed ? "" : "gap-3"} min-w-0`}>
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
                {!collapsed && <span className="truncate">{t(item.label)}</span>}
              </span>
              {item.badge !== null && !collapsed && (
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md min-w-5 text-center ${
                    active ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground/80"
                  }`}
                >
                  {item.badge}
                </span>
              )}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
                  {t(item.label)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`px-4 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50 ${collapsed ? "text-center" : ""}`}>
        {collapsed ? "v2.4" : "v2.4.1 · Production"}
      </div>
    </aside>
  );
}
