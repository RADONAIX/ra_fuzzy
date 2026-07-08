import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/lib/auth";

const COLLAPSE_KEY = "radonaix_sidebar_collapsed";

export function AppShell({
  children,
  requireAuth = true,
  requirePath,
}: {
  children: ReactNode;
  requireAuth?: boolean;
  requirePath?: string;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const { canAccess, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setAuthed(!!sessionStorage.getItem("radonaix_token"));
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  if (requireAuth && authed === null) {
    return <div className="min-h-screen bg-background" />;
  }
  if (requireAuth && !authed) {
    return <Navigate to="/login" />;
  }
  // Authenticated, but the auth context (user + permissions) hasn't hydrated
  // yet — hold the neutral shell rather than flashing ungated nav/content.
  if (requireAuth && !user) {
    return <div className="min-h-screen bg-background" />;
  }

  const checkPath = requirePath ?? pathname;
  const allowed = !user || canAccess(checkPath);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleSidebar={toggleCollapsed} />
        <main className="flex-1 px-6 py-6 overflow-x-auto">
          {allowed ? children : <Navigate to="/access-denied" />}
        </main>
      </div>
    </div>
  );
}
