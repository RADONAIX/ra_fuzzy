import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Pencil, KeyRound, Languages } from "lucide-react";
import { useT, useLanguage, LANGUAGES, type Language } from "@/lib/i18n";
import { Tooltip } from "@/components/ui-kit/Tooltip";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function LanguageCard() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  return (
    <div className="max-w-3xl bg-card border border-border rounded-xl p-6 shadow-sm mt-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Languages className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("Language")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("Choose the language for the application interface.")}
          </p>
        </div>
      </div>
      <div className="pt-4 max-w-xs">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
          aria-label={t("Language")}
          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  const t = useT();
  if (!user) return <AppShell><div /></AppShell>;
  return (
    <AppShell>
      <PageHeader title={t("User Profile")} description={t("Your account information and access.")} info={t("View your account details and switch the application language.")} />
      <div className="max-w-3xl bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-4 pb-6 border-b border-border">
          <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground text-xl font-semibold flex items-center justify-center">
            {user.avatar || user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.roleLabel || user.role}</p>
          </div>
          <StatusBadge value={user.status || "Active"} />
        </div>
        <div className="pt-2">
          <Row label={t("Email")} value={user.email} />
          <Row label={t("Role")} value={user.roleLabel || user.role} />

          <Row label={t("Department")} value={user.department || "—"} />
          <Row label={t("Last Login")} value={user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "—"} />
          <Row label={t("Account Status")} value={user.status || "Active"} />
        </div>
        <div className="flex gap-2 mt-6">
          <Tooltip label={t("Edit your profile")} side="bottom">
            <button className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              <Pencil className="h-4 w-4" /> {t("Edit Profile")}
            </button>
          </Tooltip>
          <Tooltip label={t("Change your password")} side="bottom">
            <button className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card text-sm hover:bg-muted">
              <KeyRound className="h-4 w-4" /> {t("Change Password")}
            </button>
          </Tooltip>
        </div>
      </div>

      <LanguageCard />
    </AppShell>
  );
}
