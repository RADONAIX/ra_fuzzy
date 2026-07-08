import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export type Role = "admin" | "ra_lead" | "analyst" | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  ra_lead: "RA Manager",
  analyst: "RA Analyst",
  viewer: "Report Viewer",
};

export type PermKey =
  | "dashboard"
  | "reports"
  | "pipelines"
  | "userManagement"
  | "roleManagement"
  | "settings";

export interface Permission {
  view: boolean;
  edit: boolean;
}

export type PermissionMap = Record<PermKey, Permission>;

export const PERMISSION_KEYS: { key: PermKey; label: string; path: string }[] = [
  { key: "dashboard", label: "Dashboard & KPIs", path: "/" },
  { key: "reports", label: "Reports & Certified Exports", path: "/reports" },
  { key: "pipelines", label: "Pipelines & Job Monitor", path: "/pipelines" },
  { key: "userManagement", label: "User Management", path: "/users" },
  { key: "roleManagement", label: "Role Management", path: "/roles" },
  { key: "settings", label: "Settings", path: "/system-config" },
];

// View-only allowed pages
export const VIEW_ONLY_ALLOWED: PermKey[] = ["dashboard", "reports", "pipelines"];

// Path → permission key mapping
export const PATH_TO_PERM: Record<string, PermKey> = {
  "/": "dashboard",
  "/reports": "reports",
  "/pipelines": "pipelines",
  "/users": "userManagement",
  "/roles": "roleManagement",
  "/system-config": "settings",
  "/audit-logs": "settings",
  "/monitoring": "settings",
};

const ALL_TRUE: PermissionMap = {
  dashboard: { view: true, edit: true },
  reports: { view: true, edit: true },
  pipelines: { view: true, edit: true },
  userManagement: { view: true, edit: true },
  roleManagement: { view: true, edit: true },
  settings: { view: true, edit: true },
};

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
  admin: ALL_TRUE,
  ra_lead: {
    dashboard: { view: true, edit: true },
    reports: { view: true, edit: true },
    pipelines: { view: true, edit: true },
    userManagement: { view: false, edit: false },
    roleManagement: { view: false, edit: false },
    settings: { view: true, edit: false },
  },
  analyst: {
    dashboard: { view: true, edit: false },
    reports: { view: true, edit: false },
    pipelines: { view: true, edit: false },
    userManagement: { view: false, edit: false },
    roleManagement: { view: false, edit: false },
    settings: { view: false, edit: false },
  },
  viewer: {
    dashboard: { view: true, edit: false },
    reports: { view: true, edit: false },
    pipelines: { view: true, edit: false },
    userManagement: { view: false, edit: false },
    roleManagement: { view: false, edit: false },
    settings: { view: false, edit: false },
  },
};

const PERMS_STORAGE_KEY = "radonaix_role_perms";

export function loadRolePermissions(): Record<Role, PermissionMap> {
  if (typeof window === "undefined") return DEFAULT_ROLE_PERMISSIONS;
  try {
    const raw = localStorage.getItem(PERMS_STORAGE_KEY);
    if (!raw) return DEFAULT_ROLE_PERMISSIONS;
    return { ...DEFAULT_ROLE_PERMISSIONS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ROLE_PERMISSIONS;
  }
}

export function saveRolePermissions(perms: Record<Role, PermissionMap>) {
  localStorage.setItem(PERMS_STORAGE_KEY, JSON.stringify(perms));
  window.dispatchEvent(new Event("radonaix:perms-updated"));
}

// Normalise a (possibly partial) backend permission map over the role's
// defaults so every PermKey always has a {view, edit} entry.
function normalizePerms(role: Role | undefined, backend: Partial<PermissionMap> | null): PermissionMap {
  const base = (role && DEFAULT_ROLE_PERMISSIONS[role]) || ALL_TRUE;
  if (!backend) return base;
  const out = {} as PermissionMap;
  (Object.keys(ALL_TRUE) as PermKey[]).forEach((k) => {
    out[k] = (backend[k] as Permission) ?? base[k];
  });
  return out;
}

// The current user's effective permissions, straight from the backend — i.e.
// whatever Role Management has configured for their role (administration.roles).
// Auth-only endpoint, so it works for every role (admin and non-admin alike).
export async function fetchMyPermissions(): Promise<PermissionMap | null> {
  try {
    const { data } = await api.get<Partial<PermissionMap>>("/auth/my-permissions");
    return data && Object.keys(data).length ? (data as PermissionMap) : null;
  } catch {
    return null; // unreachable / unauthorized → caller keeps the default map
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel?: string;
  department?: string;
  lastLogin?: string;
  status?: string;
  avatar?: string;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  permissions: PermissionMap;
  setSession: (token: string, user: User) => void;
  signOut: () => void;
  hasRole: (...roles: Role[]) => boolean;
  canAccess: (path: string) => boolean;
  canEdit: (path: string) => boolean;
  refreshPermissions: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

// Effective permissions are cached in sessionStorage so a page refresh can
// restore the correct map on the FIRST render — otherwise restricted tabs flash
// before the async backend load resolves.
const PERMS_SESSION_KEY = "radonaix_perms";

function initialPermissions(): PermissionMap {
  if (typeof window === "undefined") return ALL_TRUE;
  try {
    const cached = sessionStorage.getItem(PERMS_SESSION_KEY);
    if (cached) return JSON.parse(cached) as PermissionMap;
  } catch { /* ignore */ }
  try {
    const u = sessionStorage.getItem("radonaix_user");
    if (u) return normalizePerms((JSON.parse(u) as User).role, null);
  } catch { /* ignore */ }
  return ALL_TRUE;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Resolved synchronously from the cache so the first paint is already correct.
  const [permissions, setPermissions] = useState<PermissionMap>(initialPermissions);

  // Apply + cache permissions so the next refresh restores them with no flash.
  const applyPerms = useCallback((p: PermissionMap) => {
    setPermissions(p);
    try { sessionStorage.setItem(PERMS_SESSION_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }, []);

  // Pull the user's effective permissions from the backend (the authoritative
  // Role Management config). Keeps the current map if the backend is unreachable.
  const loadBackendPerms = useCallback(async (who: User | null) => {
    if (!who) return;
    const backend = await fetchMyPermissions();
    if (backend) applyPerms(normalizePerms(who.role, backend));
  }, [applyPerms]);

  // Restore session on load and refresh permissions from the backend. The
  // initial `permissions` state is already resolved from the cache, so we only
  // need to (re)fetch the authoritative copy here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = sessionStorage.getItem("radonaix_token");
    const u = sessionStorage.getItem("radonaix_user");
    if (t) setToken(t);
    if (u) {
      try {
        const parsed = JSON.parse(u) as User;
        setUser(parsed);
        loadBackendPerms(parsed);
      } catch { /* ignore */ }
    }
  }, [loadBackendPerms]);

  // Role Management dispatches this after saving — re-pull the live session's
  // permissions so changes to the current user's own role take effect at once.
  useEffect(() => {
    const handler = () => loadBackendPerms(user);
    window.addEventListener("radonaix:perms-updated", handler);
    return () => window.removeEventListener("radonaix:perms-updated", handler);
  }, [loadBackendPerms, user]);

  const setSession = (t: string, u: User) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("radonaix_token", t);
      sessionStorage.setItem("radonaix_user", JSON.stringify(u));
    }
    setToken(t);
    setUser(u);
    applyPerms(normalizePerms(u.role, null)); // immediate default, cached
    loadBackendPerms(u); // then the authoritative backend permissions
  };

  const signOut = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("radonaix_token");
      sessionStorage.removeItem("radonaix_user");
      sessionStorage.removeItem(PERMS_SESSION_KEY);
    }
    setToken(null);
    setUser(null);
    setPermissions(ALL_TRUE);
  };

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  const canAccess = (path: string) => {
    if (!user) return false;
    if (path === "/profile" || path === "/access-denied" || path === "/login") return true;
    const key = PATH_TO_PERM[path];
    if (!key) return true;
    return !!permissions[key]?.view;
  };

  const canEdit = (path: string) => {
    if (!user) return false;
    const key = PATH_TO_PERM[path];
    if (!key) return true;
    return !!permissions[key]?.edit;
  };

  const refreshPermissions = () => { loadBackendPerms(user); };

  return (
    <Ctx.Provider value={{ user, token, permissions, setSession, signOut, hasRole, canAccess, canEdit, refreshPermissions }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
