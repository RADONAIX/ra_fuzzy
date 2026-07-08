import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  DEFAULT_ROLE_PERMISSIONS,
  loadRolePermissions,
  saveRolePermissions,
  PERMISSION_KEYS,
  VIEW_ONLY_ALLOWED,
  type PermissionMap,
  type Role,
  type PermKey,
  ROLE_LABELS,
  useAuth,
} from "@/lib/auth";
import { roleService } from "@/services";
import { Plus, Pencil, X, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Tooltip } from "@/components/ui-kit/Tooltip";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/roles")({ component: RolesPage });

interface RoleRow {
  id: Role;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  createdAt: string;
  updatedAt: string;
}

function RolesPage() {
  const { canEdit, refreshPermissions } = useAuth();
  const t = useT();
  const editable = canEdit("/roles");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<Record<Role, PermissionMap>>(DEFAULT_ROLE_PERMISSIONS);
  const [selected, setSelected] = useState<Role>("ra_lead");
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    roleService.list().then((r) => {
      const list = r as RoleRow[];
      setRoles(list);
      // Seed the permission matrices from the backend roles (fall back to local).
      const merged: any = { ...loadRolePermissions() };
      list.forEach((role) => { if ((role as any).permissions) merged[role.id] = (role as any).permissions; });
      setPerms(merged);
    });
  }, []);

  const selectedRole = useMemo(() => roles.find((r) => r.id === selected), [roles, selected]);

  const togglePerm = (key: PermKey, field: "view" | "edit") => {
    if (!editable) return;
    setPerms((prev) => {
      const current = prev[selected][key];
      const next: typeof current = { ...current };
      next[field] = !current[field];
      // Edit implies View
      if (field === "edit" && next.edit) next.view = true;
      if (field === "view" && !next.view) next.edit = false;
      return { ...prev, [selected]: { ...prev[selected], [key]: next } };
    });
  };

  const savePerms = async () => {
    try {
      await roleService.updatePermissions(selected, perms[selected]);
      // Keep the local copy + RBAC context in sync for the live session.
      saveRolePermissions(perms);
      refreshPermissions();
      toast.success(t("Permissions saved"), { description: `${t("Updated for")} ${ROLE_LABELS[selected]}` });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? t("Failed to save permissions"));
    }
  };

  const upsertRole = async (r: RoleRow) => {
    try {
      await roleService.upsert({ id: r.id, name: r.name, description: r.description, status: r.status });
      setRoles((await roleService.list()) as RoleRow[]);
      toast.success(t("Role saved"));
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? t("Failed to save role"));
    }
    setEditing(null);
    setCreating(false);
  };

  return (
    <AppShell>
      <PageHeader
        title={t("Role Management")}
        description={t("Create roles, configure page-level access, and control which modules each role can view or edit.")}
        info={t("Define roles and control each module's access permissions.")}
        actions={
          editable && (
            <Tooltip label={t("Create a new role")} side="bottom">
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> {t("New role")}
              </button>
            </Tooltip>
          )
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Roles list */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Roles")}
          </div>
          <ul>
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border flex items-start gap-3 hover:bg-muted/40 ${
                    selected === r.id ? "bg-primary/5" : ""
                  }`}
                >
                  <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center ${selected === r.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm text-foreground truncate">{r.name}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {t(r.status)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {t("Updated")} {new Date(r.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {editable && (
                    <Tooltip label={t("Edit this role")} side="bottom">
                      <span
                        onClick={(e) => { e.stopPropagation(); setEditing(r); }}
                        className="text-muted-foreground hover:text-primary cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                    </Tooltip>
                  )}
                </button>
              </li>
            ))}
            {roles.length === 0 && (
              <li className="px-4 py-12 text-center text-muted-foreground text-sm">{t("No data found")}</li>
            )}
          </ul>
        </div>

        {/* Permission matrix */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm">
          {roles.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">{t("No data found")}</div>
          ) : (
          <>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("Permission matrix")}</div>
              <div className="font-semibold text-foreground">{selectedRole?.name ?? selected}</div>
            </div>
            {editable && (
              <Tooltip label={t("Save the permission changes")} side="bottom">
                <button
                  onClick={savePerms}
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                >
                  <Save className="h-4 w-4" /> {t("Save permissions")}
                </button>
              </Tooltip>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-3">{t("Module / Page")}</th>
                <th className="font-medium px-4 py-3 w-24 text-center">{t("View")}</th>
                <th className="font-medium px-4 py-3 w-24 text-center">{t("Edit")}</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_KEYS.map(({ key, label }) => {
                const p = perms[selected][key];
                const viewOnlyOnly = VIEW_ONLY_ALLOWED.includes(key);
                return (
                  <tr key={key} className="border-t border-border">
                    <td className="px-5 py-3 text-foreground">
                      {t(label)}
                      {viewOnlyOnly && (
                        <span className="ml-2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t("view-only supported")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={p.view}
                        onChange={() => togglePerm(key, "view")}
                        className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={p.edit}
                        onChange={() => togglePerm(key, "edit")}
                        className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            {t("Checking")} <b>{t("Edit")}</b> {t("automatically grants")} <b>{t("View")}</b>. {t("Unchecking")} <b>{t("View")}</b> {t("removes")} <b>{t("Edit")}</b> {t("and hides the module from the sidebar.")}
          </div>
          </>
          )}
        </div>
      </div>

      {(editing || creating) && (
        <RoleModal
          role={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={upsertRole}
        />
      )}
    </AppShell>
  );
}

function RoleModal({ role, onClose, onSave }: { role: RoleRow | null; onClose: () => void; onSave: (r: RoleRow) => void }) {
  const t = useT();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [status, setStatus] = useState<"Active" | "Inactive">(role?.status ?? "Active");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const id = (role?.id ?? (name.toLowerCase().replace(/\s+/g, "_") as Role));
    onSave({
      id: id as Role,
      name: name.trim(),
      description: description.trim(),
      status,
      createdAt: role?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <Modal title={role ? t("Edit role") : t("New role")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("Role name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="form-input" />
        </Field>
        <Field label={t("Description")}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="form-input" />
        </Field>
        <Field label={t("Status")}>
          <select value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")} className="form-input">
            <option value="Active">{t("Active")}</option>
            <option value="Inactive">{t("Inactive")}</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Tooltip label={t("Discard changes")} side="bottom">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-sm hover:bg-muted">{t("Cancel")}</button>
          </Tooltip>
          <Tooltip label={t("Save this role")} side="bottom">
            <button type="submit" className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">{t("Save role")}</button>
          </Tooltip>
        </div>
      </form>
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <Tooltip label={t("Close this dialog")} side="bottom">
            <button onClick={onClose} aria-label={t("Close")} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
