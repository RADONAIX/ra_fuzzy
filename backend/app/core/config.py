"""Application configuration via pydantic-settings.

All settings are environment-driven (12-factor). See ``.env.example`` for the
full list. Values are grouped by concern but kept flat for simple env mapping.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, PostgresDsn, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known-insecure defaults that MUST be overridden before running in production.
_INSECURE_JWT_SECRETS = {
    "change-me-in-production",
    "dev-only-change-me-to-a-48char-random-secret-000000000000",
}
_INSECURE_ADMIN_PASSWORDS = {"ChangeMe!123"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- General -----------------------------------------------------------
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    project_name: str = "RADONAIX Revenue Assurance API"
    api_prefix: str = "/api"
    log_level: str = "INFO"
    log_json: bool = True

    # CORS — comma-separated origins, or "*" for all (dev only).
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"

    # --- Auth / JWT --------------------------------------------------------
    jwt_secret: str = Field(default="change-me-in-production", min_length=8)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12h
    refresh_token_expire_minutes: int = 60 * 24 * 14  # 14 days
    # Account lockout after too many failed logins.
    max_failed_logins: int = 5
    lockout_minutes: int = 15
    # First-run bootstrap admin (created by seed if no users exist).
    bootstrap_admin_email: str = "admin@radonaix.io"
    bootstrap_admin_password: str = "ChangeMe!123"
    # Per-IP rate limit on the login endpoint (brute-force speed bump).
    login_rate_limit_max: int = 10
    login_rate_limit_window_seconds: int = 60

    # --- App database (NEW — owns users/roles/cases/reports/audit) ---------
    app_db_host: str = "localhost"
    app_db_port: int = 5432
    app_db_name: str = "radonaix_app"
    app_db_user: str = "radonaix"
    app_db_password: str = "radonaix"
    # Dedicated application schema (set as connection search_path).
    app_db_schema: str = "administration"
    # Kept small: app DB, ra_pg and bi_pg often share one Postgres instance, and
    # each pool is per-gunicorn-worker — so total connections = workers x (sum of
    # all three pools). Stay well under the server's max_connections.
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_echo: bool = False

    # --- Redis (cache + Celery broker/result backend) ----------------------
    # ONLY needed when EXPORTS_ENABLED=true: Redis is the Celery broker for the
    # bulk-export jobs. With exports disabled the app never connects to Redis,
    # so these values are inert. (The cache helper remains optional.)
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # --- Bulk exports (async report downloads) -----------------------------
    # Master switch. When false, every /exports route returns 503 and no Redis/
    # Celery worker is required. Turn on only after Redis + the worker are running.
    exports_enabled: bool = True
    export_retention_days: int = 7
    export_max_concurrent_per_user: int = 3
    export_max_date_span_days: int = 31
    export_chunk_rows: int = 50_000
    # Scale hardening (billion-row exports). gzip 1 ≈ half the CPU/wall-clock of 9
    # for ~30-50% larger files (fine on the 2 TB volume).
    export_gzip_level: int = 1
    # Redis re-delivers an un-acked task after this window; MUST exceed the longest
    # single task or a long export runs twice (with task_acks_late).
    export_visibility_timeout_seconds: int = 43_200  # 12 h
    # Time limits. Both MUST stay under visibility_timeout or a task that outlives
    # it is re-delivered and runs twice. A single-file/finalize task gets the JOB
    # limit; each fan-out part gets the (tighter) PART limit.
    export_job_soft_limit_seconds: int = 39_600  # 11 h (single-file + finalize)
    export_part_soft_limit_seconds: int = 21_600  # 6 h per part (hard limit is +5 min)
    # Postgres exact-count statement_timeout; on timeout the job streams with an
    # unknown total (indeterminate progress). ClickHouse counts are always exact.
    export_count_timeout_seconds: int = 15
    export_progress_commit_seconds: float = 2.0  # throttle progress writes (was per-chunk)
    # Multi-part planning (app/modules/exports/planning.py). Large exports fan out
    # into date-bounded parts run concurrently, then concatenate into one .csv.gz.
    # The trigger is estimated ROWS (→ duration), NOT calendar span, so a wide,
    # no-date-range export still parallelises instead of a lone multi-hour task.
    export_multipart_row_threshold: int = 2_000_000  # est. rows > this → fan out
    export_target_part_rows: int = 5_000_000  # aim for ~this many rows per part
    export_days_per_part: int = 7  # max calendar days packed into one part
    export_histogram_timeout_seconds: int = 20  # per-day density sizing pass (guarded)
    export_single_file_hard_max_rows: int = 50_000_000  # no date column + bigger → reject
    export_soft_max_parts: int = 60  # warn above this many parts
    export_hard_max_parts: int = 200  # reject above this many parts
    # Resilience: a transient blip in ONE part must not lose a multi-hour job.
    # Each part retries with backoff; only after exhausting retries does the part
    # (and the job) fail. Finalize (the concat) retries similarly.
    export_part_max_retries: int = 2
    export_part_retry_countdown: int = 60  # seconds between part retries
    export_finalize_max_retries: int = 2
    export_finalize_retry_countdown: int = 30
    # Disk safety: refuse a job that can't fit, and cap total live-artifact storage.
    export_bytes_per_row_estimate: int = 200
    export_min_free_bytes: int = 21_474_836_480  # 20 GB free floor
    export_max_total_storage_gb: int = 800  # of the 2 TB volume
    # Hand large downloads to nginx (native Range/resume + sendfile) via
    # X-Accel-Redirect; false → FastAPI streams the file (local dev / no nginx).
    export_xaccel_enabled: bool = True
    export_xaccel_location: str = "/_export_files"

    # Demo mode for the verdicts screen: when true, /recon/verdicts returns a
    # synthetic timeline scored by the real IT2+CWW engine (no ClickHouse needed).
    # For demos/local only — keep false in production.
    verdicts_demo_mode: bool = False

    # --- ra-platform integration: ClickHouse (read-only recon data) --------
    clickhouse_enabled: bool = True
    clickhouse_host: str = "localhost"
    clickhouse_port: int = 8123
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_database: str = "rafms"

    # --- ra-platform integration: Postgres (read-only file_log/batches) ----
    ra_pg_enabled: bool = True
    ra_pg_host: str = "10.200.37.142"
    ra_pg_port: int = 5432
    ra_pg_name: str = "rafms_app"
    ra_pg_user: str = "postgres"
    ra_pg_password: str = "postgres"
    # Pipeline batch-log / file-log tables now live in per-DAG schemas
    # (air_schema, sdp_schema, msc_schema). The schema + table names per
    # DAG/stream live in code registries (operations.service).

    # --- Data sources / streams (plug-and-play) ----------------------------
    # Enabled data streams, comma-separated (e.g. "air,sdp" or "air,sdp,ccn").
    # Adding a conventional new source = just add its key here. The schema and
    # table names are derived from the key by convention (see core/data_sources).
    data_streams: str = "air,sdp"
    # Optional YAML that overrides convention for a source that lives on a
    # different schema or breaks the naming convention. Empty = convention only.
    data_sources_file: str = ""
    # Per-worker connection pool for the read-only ra_pg AND bi_pg engines
    # (they share these creds). Total Postgres connections = workers x
    # (app pool + 2 x ra_pg pool), so keep these small and watch max_connections.
    ra_pg_pool_size: int = 3
    ra_pg_max_overflow: int = 2
    ra_pg_pool_recycle: int = 1800

    # --- Pipeline Map (operations) row caps --------------------------------
    # Safety ceilings on the read-only pipeline batch/file queries. The time
    # window (pipeline_default_hours) is the real filter; these LIMITs just stop
    # a runaway result set. Raise only if a legitimate window can exceed them.
    pipeline_batch_row_cap: int = 5000
    pipeline_file_row_cap: int = 100_000
    # Default look-back window (hours) for /pipelines/batches when the caller
    # doesn't pass ?hours=. The router still clamps the request to 1..168.
    pipeline_default_hours: int = 12

    # --- ra-platform integration: BI Postgres (read-only report matviews) ---
    # Same server/creds as ra_pg above, but a DIFFERENT database (`rafms`) whose
    # `bi_reports` schema holds the pre-computed report materialized views.
    ra_bi_pg_name: str = "rafms"
    ra_bi_pg_schema: str = "bi_reports"

    # --- ra-platform integration: Airflow REST (pipeline control) ----------
    airflow_enabled: bool = False
    airflow_base_url: str = "http://localhost:8081/api/v1"
    airflow_username: str = "airflow"
    airflow_password: str = "airflow"

    # --- SSO / OAuth (Google + Microsoft, server-side redirect flow) -------
    sso_enabled: bool = False
    # This backend's public base URL — used to build a provider callback URL
    # when one isn't given explicitly. Must be browser-reachable after consent.
    api_base_url: str = "http://localhost:8000"
    # Where the backend sends the browser AFTER a successful SSO sign-in (it
    # appends ?token=<jwt>). This route consumes the token and starts the
    # session. NOTE: this is NOT the Microsoft redirect_uri (that is the backend
    # /callback below) — it's the final hop back into the SPA.
    frontend_success_redirect: str = Field(
        "http://localhost:8080/login",
        validation_alias=AliasChoices("FRONTEND_SUCCESS_REDIRECT", "SSO_DEFAULT_REDIRECT"),
    )
    # First-time SSO logins auto-provision a user with this role.
    sso_auto_provision: bool = True
    sso_default_role: str = "viewer"
    # Google OAuth 2.0 / OIDC client.
    google_client_id: str = ""
    google_client_secret: str = ""
    # Microsoft Entra ID (Azure AD) client. tenant = "common" | "organizations" | <tenant-id>.
    microsoft_client_id: str = Field(
        "", validation_alias=AliasChoices("MS_CLIENT_ID", "MICROSOFT_CLIENT_ID")
    )
    microsoft_client_secret: str = Field(
        "", validation_alias=AliasChoices("MS_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET")
    )
    microsoft_tenant: str = Field(
        "common", validation_alias=AliasChoices("MS_TENANT_ID", "MICROSOFT_TENANT")
    )
    # The EXACT redirect_uri registered in Azure (Web platform). Used identically
    # in the authorize request and the token exchange — they must match.
    ms_redirect_uri: str = Field(
        "http://localhost:8000/api/auth/oauth/microsoft/callback",
        validation_alias=AliasChoices("MS_REDIRECT_URI"),
    )

    # --- Superset (embedded analytics dashboard, guest-token flow) ---------
    # The backend mints a short-lived guest token (admin login -> CSRF -> guest
    # token) for the UI's embedded dashboard. Off by default; set
    # SUPERSET_ENABLED=true + SUPERSET_ADMIN_PASSWORD to turn it on.
    superset_enabled: bool = False
    superset_base_url: str = "http://10.200.37.142:8088"
    superset_admin_username: str = "admin"
    superset_admin_password: str = ""
    superset_guest_username: str = "rafms_user"
    superset_dashboard_id: str = "357ecae5-5f29-49f8-8dbd-b3f8d3f6be63"

    # --- Email / SMTP (password reset + notifications) ---------------------
    # When smtp_enabled is False the mailer LOGS each message (including the
    # password-reset link) at INFO instead of sending — so the forgot/reset flow
    # works in dev/test without a mail server. Turn on + fill creds to send.
    smtp_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@radonaix.io"
    smtp_starttls: bool = True
    # SPA origin used to build user-facing links (e.g. the password-reset link:
    # {frontend_base_url}/reset-password?token=<token>).
    frontend_base_url: str = "http://localhost:8080"
    # Password-reset token lifetime (minutes).
    reset_token_ttl_minutes: int = 30

    # --- Reporting ---------------------------------------------------------
    reports_dir: str = "/var/lib/radonaix/reports"
    # Drill-down (on-screen table) row cap; the full set is available via CSV.
    reports_detail_limit: int = 10_000
    # Hard safety ceiling for the CSV export so an enormous table can't OOM the API.
    reports_export_limit: int = 1_000_000

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def app_database_url(self) -> str:
        """Async SQLAlchemy URL for the app database."""
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.app_db_user,
                password=self.app_db_password,
                host=self.app_db_host,
                port=self.app_db_port,
                path=self.app_db_name,
            )
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def app_database_url_sync(self) -> str:
        """Sync URL (used by Alembic migrations)."""
        return str(
            PostgresDsn.build(
                scheme="postgresql+psycopg2",
                username=self.app_db_user,
                password=self.app_db_password,
                host=self.app_db_host,
                port=self.app_db_port,
                path=self.app_db_name,
            )
        )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _enforce_production_secrets(self) -> Settings:
        """Fail fast if production is started with default/weak secrets."""
        if self.environment != "production":
            return self
        problems: list[str] = []
        if (
            self.jwt_secret in _INSECURE_JWT_SECRETS
            or self.jwt_secret.startswith("dev-only-change-me")
            or len(self.jwt_secret) < 32
        ):
            problems.append(
                "JWT_SECRET must be a unique random value of at least 32 characters"
            )
        if self.bootstrap_admin_password in _INSECURE_ADMIN_PASSWORDS:
            problems.append("BOOTSTRAP_ADMIN_PASSWORD must be changed from the default")
        if problems:
            raise ValueError(
                "Refusing to start in production with insecure configuration: "
                + "; ".join(problems)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
