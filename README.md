# RADONaix — Fuzzy Revenue-Assurance Verdicts

A **profile-driven Interval Type-2 (IT2) fuzzy + Computing-With-Words (CWW)**
verdict layer for telecom revenue assurance. Each RA report's hourly discrepancy
metrics are classified into a plain verdict — `Healthy / Watch / Suspect /
Critical` — with an uncertainty band and an IF/THEN rule trace, on top of the
existing RADONaix platform.

The core idea: **don't fuzzify the counting — fuzzify the verdict.** A
deterministic layer produces crisp metrics; the fuzzy layer turns them into a
context-aware triage verdict. The recurring insight it captures is *latency ≠
loss*: a gap that catches up (late file, delayed batch, in-flight cross-event,
retry-cleared exception) is discounted, where a crisp threshold would false-alarm.

## Reports (verdict profiles)

One shared engine, seven pluggable profiles — adding a report is a profile
(vocabulary + rule base) + a data extractor, with no engine or UI changes:

| Profile | Report | Benchmark |
|---|---|---|
| `recon` | AIR pre→post reconciliation | ✅ |
| `file_sequence` | Missing File Sequence (FR-038–043) | ✅ |
| `cross_recon` | AIR↔SDP cross-reconciliation (FR-059) | ✅ |
| `file_collection` | File Collection & Load (FR-032–037) | ✅ |
| `processing_exception` | File Processing & Exception (FR-050–055) | ✅ |
| `record_sequence` | Missing Record Sequence (FR-044–049) | — (severity, not incident) |
| `overview` | Platform health roll-up (FR-060) | — (meta) |

A **benchmark harness** scores each benchmarked profile against a crisp
threshold baseline on a labelled set (precision/recall/F1 + catch-up false
alarms) — evidence the fuzzy layer earns its place rather than being trusted.

## Layout

```
recon_fuzzy/                       ← repo root
├── CLAUDE.md                      design rationale + confirmed data decisions
├── backend/                       FastAPI modular monolith (the RADONaix API)
│   └── app/modules/assurance/verdicts/
│       ├── engine.py              report-agnostic: VerdictProfile + score()
│       ├── profiles.py            the 7 profiles (vocab + rules) + registry
│       ├── it2.py                 IT2 core: trapezoids, Nie-Tan, Jaccard
│       ├── demo.py                synthetic timelines (demo mode)
│       └── benchmark.py           fuzzy-vs-baseline labelled harness
└── ui/                            React (TanStack Start) — the "Fuzzy Verdicts" screen
```

The verdict endpoints live in `backend/app/modules/assurance/` (`router.py`,
`service.py`, `schemas.py`): `GET /api/verdicts/profiles`,
`GET /api/verdicts?profile=&hours=`, `GET /api/verdicts/benchmark?profile=`.

## Run locally (no Docker, fully isolated)

The backend reads its own dev config from `backend/.env` (git-ignored). It runs
against a **throwaway local Postgres on port 5433** and, with
`VERDICTS_DEMO_MODE=true`, serves synthetic verdict data — so it never touches
any real ra-platform data store (ClickHouse / ra_pg are disabled).

```bash
# --- backend ---
cd backend
make install                                   # uv venv + deps (Python 3.11+)
pg_ctl -D .localdb -o "-p 5433 -k /tmp" -l .localdb/server.log start   # first run: initdb -D .localdb --auth-host=trust
alembic upgrade head                           # migrate the isolated DB
python -m app.seed                             # seed roles + admin user
./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8010

# --- ui (separate terminal) ---
cd ui
bun install
bun run dev                                    # → http://localhost:8080
```

Open **http://localhost:8080**, sign in (`admin@radonaix.io` / `ChangeMe!123`),
and use the **Fuzzy Verdicts** screen — pick a report, toggle 24h/48h/7d, expand
a row for its rule trace, and read the fuzzy-vs-baseline panel.

> `pip install -r backend/requirements.txt` also works in a **Python 3.11+**
> venv (the pins require 3.11+).

## Test

```bash
cd backend && .venv/bin/python -m pytest tests/test_verdicts.py -q
```

## Real data

Everything above runs in **demo mode**. To score live `rafms` data, set the
ClickHouse env vars and `VERDICTS_DEMO_MODE=false`; the recon profile reads the
source unions, and each report's real extractor is wired as its source tables
come online. See [CLAUDE.md](CLAUDE.md) for the confirmed data mappings.
```
