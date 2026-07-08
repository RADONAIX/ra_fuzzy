import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { userService, roleService } from "@/services";
import { Plus, Pencil, Search, KeyRound, Power, PowerOff } from "lucide-react";
import { Modal, Field } from "./roles";
import { useAuth, ROLE_LABELS, type Role } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { Tooltip } from "@/components/ui-kit/Tooltip";
import { ConfirmDialog } from "@/components/ui-kit/ConfirmDialog";

export const Route = createFileRoute("/users")({ component: UsersPage });

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  role: Role;
  status: "Active" | "Disabled";
  lastLogin: string;
  createdAt: string;
}

function UsersPage() {
  const { canEdit } = useAuth();
  const t = useT();
  const editable = canEdit("/users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ id: Role; name: string }[]>([]);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmToggle, setConfirmToggle] = useState<UserRow | null>(null);

  useEffect(() => {
    userService.listFull().then((u) => setUsers(u as UserRow[]));
    roleService.list().then((r: any) => setRoles(r));
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      const q = query.toLowerCase();
      if (q && !(u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [users, query, roleFilter, statusFilter]);

  const reload = () => userService.listFull().then((u) => setUsers(u as UserRow[]));

  const upsert = async (u: UserRow & { password?: string }) => {
    const exists = users.some((x) => x.id === u.id);
    try {
      if (exists) {
        await userService.update(u.id, {
          fullName: u.fullName, email: u.email, phone: u.phone,
          department: u.department, role: u.role, status: u.status,
        });
      } else {
        await userService.create({
          fullName: u.fullName, email: u.email,
          password: u.password || "ChangeMe!123", role: u.role,
          phone: u.phone, department: u.department, status: u.status,
          mustResetPassword: true,
        });
      }
      await reload();
      toast.success(exists ? t("User updated") : t("User created"));
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? t("Failed to save user"));
    }
    setEditing(null);
    setCreating(false);
  };

  const toggleStatus = async (u: UserRow) => {
    const next = (u.status === "Active" ? "Disabled" : "Active") as "Active" | "Disabled";
    try {
      await userService.update(u.id, { status: next });
      await reload();
      toast.success(next === "Active" ? t("Account activated") : t("Account deactivated"), {
        description: `${u.fullName} ${t("is now")} ${next === "Active" ? t("active") : t("disabled")}.`,
      });
    } catch {
      toast.error(t("Failed to update status"));
    }
    setConfirmToggle(null);
  };

  const resetPwd = (u: UserRow) => toast.success(`${t("Password reset sent to")} ${u.email}`);

  return (
    <AppShell>
      <PageHeader
        title={t("User Management")}
        description={t("Manage operators, analysts and auditors who have access to RADONaix. Assign roles to control permissions.")}
        info={t("Create and manage users and assign their roles.")}
        actions={
          editable && (
            <Tooltip label={t("Add a new user")} side="bottom">
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> {t("Add user")}
              </button>
            </Tooltip>
          )
        }
      />

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search by name or email")}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-border bg-background text-sm">
            <option value="all">{t("All roles")}</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-border bg-background text-sm">
            <option value="all">{t("All status")}</option>
            <option value="Active">{t("Active")}</option>
            <option value="Disabled">{t("Disabled")}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Full Name", "Email", "Phone", "Department", "Role", "Status", "Last Login", ""].map((h) => (
                  <th key={h} className="text-left font-medium px-4 py-3">{h ? t(h) : h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{u.fullName}</td>
                  <td className="px-4 py-3 text-foreground/80">{u.email}</td>
                  <td className="px-4 py-3 text-foreground/80">{u.phone}</td>
                  <td className="px-4 py-3 text-foreground/80">{u.department}</td>
                  <td className="px-4 py-3 text-foreground/80">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${u.status === "Active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {t(u.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.lastLogin).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {editable && (
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip label={t("Edit this user")} side="bottom">
                          <button onClick={() => setEditing(u)} aria-label={t("Edit user")} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        </Tooltip>
                        <Tooltip label={t("Reset this user's password")} side="bottom">
                          <button onClick={() => resetPwd(u)} aria-label={t("Reset password")} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"><KeyRound className="h-3.5 w-3.5" /></button>
                        </Tooltip>
                        <Tooltip label={u.status === "Active" ? t("Deactivate this account") : t("Activate this account")} side="bottom">
                          <button onClick={() => setConfirmToggle(u)} aria-label={u.status === "Active" ? t("Deactivate account") : t("Activate account")} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                            {u.status === "Active" ? <PowerOff className="h-3.5 w-3.5 text-destructive" /> : <Power className="h-3.5 w-3.5 text-success" />}
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">{users.length === 0 ? t("No data found") : t("No users match the current filters.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(editing || creating) && (
        <UserModal
          user={editing}
          roles={roles}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={upsert}
        />
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.status === "Active" ? t("Confirm Deactivation") : t("Confirm Activation")}
        message={
          confirmToggle?.status === "Active"
            ? `${t("This action will deactivate")} ${confirmToggle?.fullName ?? t("this account")}. ${t("The user will no longer be able to access the application.")}`
            : `${t("This action will activate")} ${confirmToggle?.fullName ?? t("this account")} ${t("and allow access based on assigned permissions.")}`
        }
        confirmLabel={confirmToggle?.status === "Active" ? "Confirm Deactivate" : "Confirm Activate"}
        tone={confirmToggle?.status === "Active" ? "danger" : "success"}
        icon={confirmToggle?.status === "Active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
        onCancel={() => setConfirmToggle(null)}
        onConfirm={() => confirmToggle && toggleStatus(confirmToggle)}
      />
    </AppShell>
  );
}

function UserModal({ user, roles, onClose, onSave }: { user: UserRow | null; roles: { id: Role; name: string }[]; onClose: () => void; onSave: (u: UserRow & { password?: string }) => void }) {
  const t = useT();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? (roles[0]?.id as Role) ?? "analyst");
  const [status, setStatus] = useState<"Active" | "Disabled">(user?.status ?? "Active");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: user?.id ?? `u-${Date.now()}`,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department: department.trim(),
      role,
      status,
      lastLogin: user?.lastLogin ?? now,
      createdAt: user?.createdAt ?? now,
      password: password || undefined,
    });
  };

  return (
    <Modal title={user ? t("Edit user") : t("Add user")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Full name")}><input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input" /></Field>
          <Field label={t("Email")}><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" /></Field>
          <Field label={t("Phone")}><input value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" /></Field>
          <Field label={t("Department")}><input value={department} onChange={(e) => setDepartment(e.target.value)} className="form-input" /></Field>
          <Field label={t("Assigned role")}>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="form-input">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label={t("Status")}>
            <select value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Disabled")} className="form-input">
              <option value="Active">{t("Active")}</option><option value="Disabled">{t("Disabled")}</option>
            </select>
          </Field>
          {!user && (
            <Field label={t("Temporary password")}>
              <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("min 8 chars")} className="form-input" />
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Tooltip label={t("Discard changes")} side="bottom">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-sm hover:bg-muted">{t("Cancel")}</button>
          </Tooltip>
          <Tooltip label={t("Save this user")} side="bottom">
            <button type="submit" className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">{t("Save user")}</button>
          </Tooltip>
        </div>
      </form>
    </Modal>
  );
}
