import { api } from "@/lib/api";
import type { Role } from "@/lib/auth";

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const { data } = await api.get<T>(path);
    return data;
  } catch {
    return fallback;
  }
}

const DEMO_ACCOUNTS: Record<string, { id: string; name: string; role: Role; roleLabel: string; avatar: string; department: string }> = {
  "admin@radonaix.io": { id: "u-000", name: "Daniel Okafor", role: "admin", roleLabel: "Administrator", avatar: "DO", department: "Platform Ops" },
  "aarav.mehta@radonaix.io": { id: "u-001", name: "Aarav Mehta", role: "ra_lead", roleLabel: "RA Manager", avatar: "AM", department: "Finance Operations" },
  "priya.shah@radonaix.io": { id: "u-002", name: "Priya Shah", role: "analyst", roleLabel: "RA Analyst", avatar: "PS", department: "Assurance" },
  "viewer@radonaix.io": { id: "u-003", name: "Mei Tanaka", role: "viewer", roleLabel: "Report Viewer", avatar: "MT", department: "Compliance" },
};

const AUTH_BASE = (import.meta as any).env?.VITE_AUTH_API_BASE ?? "http://localhost:8000";

export const authService = {
  login: async (email: string, password: string) => {
    // Real backend login. No demo-token fallback and no stale localStorage
    // "disabled" pre-check — the backend is the auth authority and returns the
    // correct message (disabled account / invalid credentials / lockout), which
    // we surface verbatim.
    const res = await fetch(`${AUTH_BASE}/api/auth/login`, {
      method: "POST",
      headers: { accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      let message = `Login failed (${res.status})`;
      try { message = (await res.json())?.error?.message || message; } catch { /* non-JSON body */ }
      throw new Error(message);
    }
    return res.json() as Promise<{ token: string; refreshToken?: string; user: any }>;
  },
  // SSO: the backend completes the OAuth exchange server-side and redirects
  // back with ?token=<jwt>. We resolve the signed-in user from that token.
  ssoLoginUrl: (provider: "google" | "microsoft") =>
    `${AUTH_BASE}/api/auth/oauth/${provider}/login`,
  me: async (token: string) => {
    const res = await fetch(`${AUTH_BASE}/api/auth/me`, {
      headers: { accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Could not resolve session (${res.status})`);
    return res.json();
  },
  logout: () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("radonaix_token");
      sessionStorage.removeItem("radonaix_user");
    }
  },
  profile: () =>
    safeGet("/auth/me", {
      id: "u-001", name: "Aarav Mehta", email: "aarav.mehta@radonaix.io",
      role: "ra_lead", roleLabel: "RA Manager", department: "Finance Operations",
      lastLogin: "2026-06-02T08:14:00Z", status: "Active", avatar: "AM",
    }),
};

// Admin-module reads return an empty list when the backend has no data or is
// unreachable — the screens render a "No data found" state rather than seeded
// demo rows.
export const userService = {
  list: () => safeGet<any[]>("/users", []),
  listFull: () => safeGet<any[]>("/users", []),
  // Writes hit the backend so changes persist in administration.users (the DB).
  create: (payload: {
    fullName: string; email: string; password: string; role: string;
    phone?: string; department?: string; status?: string; mustResetPassword?: boolean;
  }) => api.post("/users", payload).then((r) => r.data),
  update: (id: string, payload: Partial<{
    fullName: string; email: string; password: string; role: string;
    phone: string; department: string; status: string;
  }>) => api.patch(`/users/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
};

export const roleService = {
  list: () => safeGet<any[]>("/roles", []),
  // Writes hit the backend so changes persist in administration.roles.
  upsert: (payload: { id?: string; name: string; description?: string; status?: string; permissions?: any }) =>
    api.post("/roles", payload).then((r) => r.data),
  update: (id: string, payload: Partial<{ name: string; description: string; status: string }>) =>
    api.patch(`/roles/${id}`, payload).then((r) => r.data),
  updatePermissions: (id: string, permissions: any) =>
    api.put(`/roles/${id}/permissions`, { permissions }).then((r) => r.data),
};

export const auditService = {
  list: () => safeGet<any[]>("/audit-logs", []),
};

export const systemConfigService = {
  get: () =>
    safeGet("/system/config", {
      environment: "production", retentionDays: 365, slaMinutes: 15,
      alertEmail: "ops-alerts@radonaix.io", maintenanceMode: false,
    }),
  // Persists to administration.system_config via PUT /system/config.
  update: (payload: Partial<{
    environment: string; retentionDays: number; slaMinutes: number;
    alertEmail: string; maintenanceMode: boolean;
  }>) => api.put("/system/config", payload).then((r) => r.data),
};

// --- Reconciliation verdicts (IT2 + CWW hourly triage) ---------------------
export type Verdict = "Healthy" | "Watch" | "Suspect" | "Critical";

export interface VerdictDriver {
  rule: string; // e.g. "value_gap=large & catchup=low"
  consequent: string; // Healthy | Watch | Suspect | Critical
  firingLo: number;
  firingHi: number;
}

export interface VerdictRow {
  recordType: string;
  hour: string; // ISO timestamp (UTC hour bucket)
  // Layer-1 discrepancy vector
  rawCount: number;
  procCount: number;
  matched: number;
  catchup: number;
  rawOnly: number;
  procOnly: number;
  dupCount: number;
  amtMismatch: number;
  countGapPct: number;
  valueGapPct: number;
  dupRatePct: number;
  catchupRatePct: number;
  mismatchRatePct: number;
  trafficPct: number;
  // Layer-2 verdict
  verdict: Verdict;
  score: number;
  bandLo: number;
  bandHi: number;
  similarity: number;
  drivers: VerdictDriver[];
}

export const reconVerdictService = {
  // Hourly IT2 + CWW verdicts. Returns [] when the backend or ClickHouse is
  // unavailable (the screen renders an empty state rather than erroring).
  list: (hours = 48, stream = "air") =>
    safeGet<VerdictRow[]>(`/recon/verdicts?hours=${hours}&stream=${stream}`, []),
};

// --- Generic, profile-driven verdicts (recon, file_sequence, …) ------------
export interface ProfileMetric {
  key: string;
  label: string;
}

export interface ProfileInfo {
  key: string;
  label: string;
  entityLabel: string; // what the scored entity is called (Record type / Source / …)
  metrics: ProfileMetric[]; // ordered — drives the table columns
  hasBenchmark: boolean;
}

export interface BenchmarkMetrics {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  falseAlarmRate: number;
}

export interface BenchmarkReport {
  profile: string;
  sampleSize: number;
  baselineName: string;
  fuzzy: BenchmarkMetrics;
  baseline: BenchmarkMetrics;
  latencyFalseAlarms: { total: number; fuzzy: number; baseline: number };
}

export interface ProfileVerdictRow {
  profile: string;
  entity: string;
  hour: string;
  verdict: Verdict;
  score: number;
  bandLo: number;
  bandHi: number;
  similarity: number;
  metrics: Record<string, number>; // the crisp fuzzy inputs (report-specific)
  context: Record<string, number>; // extra counts for the detail panel
  drivers: VerdictDriver[];
}

export const verdictService = {
  profiles: () => safeGet<ProfileInfo[]>(`/verdicts/profiles`, []),
  list: (profile: string, hours = 48) =>
    safeGet<ProfileVerdictRow[]>(`/verdicts?profile=${profile}&hours=${hours}`, []),
  // null when the profile has no benchmark (e.g. the overview roll-up → 404).
  benchmark: (profile: string) =>
    safeGet<BenchmarkReport | null>(`/verdicts/benchmark?profile=${profile}`, null),
};
