import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { authService } from "@/services";
import { toast } from "sonner";

type SsoProvider = "google" | "microsoft";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import loginHero from "@/assets/login-hero.jpg";
import { Tooltip } from "@/components/ui-kit/Tooltip";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { setSession } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@radonaix.io");
  const [password, setPassword] = useState("demo");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  // Guard against React StrictMode double-invoking the callback effect.
  const ssoHandled = useRef(false);

  // SSO callback: the BACKEND completes the OAuth code exchange server-side and
  // redirects back to /login?token=<jwt> (or ?error=…). We just resolve the
  // user from that token and start the session — no token exchange in browser.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");
    if (!token && !err) return;
    if (ssoHandled.current) return;
    ssoHandled.current = true;

    const cleanUrl = () => window.history.replaceState({}, "", "/login");
    if (err) {
      toast.error(decodeURIComponent(err));
      cleanUrl();
      return;
    }
    setSsoLoading(true);
    (async () => {
      try {
        const user = await authService.me(token!);
        setSession(token!, user);
        toast.success(t("Welcome back"));
        navigate({ to: "/" });
      } catch (e: any) {
        toast.error(e?.message || t("Login failed"));
      } finally {
        setSsoLoading(false);
        cleanUrl();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hand off to the backend OAuth login endpoint — the whole exchange (and the
  // client secret) stays server-side.
  const onSso = (provider: SsoProvider) => {
    setSsoLoading(true);
    window.location.href = authService.ssoLoginUrl(provider);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authService.login(email, password);
      setSession(res.token, res.user);
      toast.success(t("Welcome back"));
      navigate({ to: "/" });
    } catch (err: any) {
      // Surface the backend's message (e.g. "Your account has been disabled.",
      // "Invalid email or password.", lockout) instead of the generic axios
      // "Request failed with status code 401".
      toast.error(err?.response?.data?.error?.message || err?.message || t("Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: hero illustration */}
      <div className="hidden lg:block relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-yellow-50">
        <img
          src={loginHero}
          alt={t("Secure revenue assurance")}
          className="absolute inset-0 h-full w-full object-cover"
          width={1280}
          height={1280}
        />
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-card">
        <div className="w-full max-w-md">
          {/* RADONaix logo */}
          <div className="mb-10">
            <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-extrabold text-xl tracking-tight" aria-label="RADONaix">
                RA
              </span>
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground">{t("Welcome back")}</h1>
          <p className="mt-2 text-base text-muted-foreground">{t("Sign in to your account")}</p>

          <form onSubmit={onSubmit} className="mt-10 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">{t("Email")}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-card border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">{t("Password")}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-12 rounded-2xl bg-card border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={t("Toggle password")}
                  title={t("Show or hide the password")}
                >
                  {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Tooltip label={t("Sign in to your account")} side="bottom" className="w-full">
              <button
                type="submit"
                disabled={loading}
                className="relative group w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-95 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    <span>{t("Sign in")}</span>
                    <ArrowRight className="h-5 w-5 absolute right-8 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </Tooltip>
          </form>

          {/* Single sign-on */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t("or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => onSso("google")}
              disabled={ssoLoading || loading}
              className="w-full h-12 rounded-2xl border border-border bg-card flex items-center justify-center gap-3 text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-60"
            >
              {ssoLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.6-11.3-8.5l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.5 44 30.9 44 24c0-1.3-.1-2.3-.4-3.5z" />
                </svg>
              )}
              {t("Continue with Google")}
            </button>

            <button
              type="button"
              onClick={() => onSso("microsoft")}
              disabled={ssoLoading || loading}
              className="w-full h-12 rounded-2xl border border-border bg-card flex items-center justify-center gap-3 text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-60"
            >
              {ssoLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#7FBA00" d="M12 1h10v10H12z" />
                  <path fill="#00A4EF" d="M1 12h10v10H1z" />
                  <path fill="#FFB900" d="M12 12h10v10H12z" />
                </svg>
              )}
              {t("Continue with Microsoft")}
            </button>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-8">
            {t('Demo accounts available — password is "demo"')}
          </p>
        </div>
      </div>
    </div>
  );
}
