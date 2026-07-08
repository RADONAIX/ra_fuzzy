# RADONaix — RA Reconciliation

Hourly **revenue-assurance reconciliation** for an Ericsson **AIR** feed. It
compares the network side (raw, pre-mediation) against the mediation side
(processed, post-mediation) and classifies each hour with an **Interval Type-2
(IT2) fuzzy + Computing-With-Words** engine, producing a plain verdict:
`Healthy / Watch / Suspect / Critical`.

Two layers, strictly separated:

- **Layer 1 (`recon/`)** — deterministic, exact, auditable. Produces the
  per-`(record_type, hour)` discrepancy vector. No fuzziness.
- **Layer 2 (`fuzzy/`)** — the IT2 + CWW verdict engine. Consumes Layer 1's
  vector, never touches raw records.

> See [CLAUDE.md](CLAUDE.md) for the full design rationale, confirmed data
> decisions, and known quirks. Read it before changing engine code.

## Repository layout

```
recon_fuzzy/                      ← repo root
├── CLAUDE.md                     design doc / decisions (read first)
├── README.md                     this file
├── radonaix_recon_dashboard.jsx  built dashboard (React)
└── radonaix-recon-mvp/           the Python backend
    ├── recon/       Layer 1  — normalize + reconcile
    ├── fuzzy/       Layer 2  — IT2 core + CWW verdict engine
    ├── demo/        scenario injector, pipeline runner, dashboard template
    ├── data/        source CSV extracts (git-ignored, not committed)
    ├── out/         generated verdicts / logs (git-ignored)
    ├── requirements.txt
    ├── requirements-dev.txt
    └── Makefile
```

## Prerequisites

- Python 3.9+ (3.11+ recommended for production)
- The four AIR CSV extracts (raw refill, raw adjustment, processed RR,
  processed AA)

## Setup

All commands run from `radonaix-recon-mvp/`.

```bash
cd radonaix-recon-mvp

# 1) create the venv and install dependencies
make setup            # or: python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt

# 2) provide the source data — the loader expects the 4 CSVs in data/
mkdir -p data
# copy or symlink the extracts into data/ using their original filenames, e.g.:
#   ln -s /path/to/refill_record_*_refill_rec_raw.csv          data/
#   ln -s /path/to/adjustment_record_*_adj_rec_raw.csv         data/
#   ln -s /path/to/air_processed_rr_*_processed_rr.csv         data/
#   ln -s /path/to/air_processed_aa_*_processed_aa.csv         data/
```

The exact filenames the loader looks for are listed in
[recon/normalize.py](radonaix-recon-mvp/recon/normalize.py) (`load_all`).

## Run

```bash
make run              # or: ./.venv/bin/python demo/run_demo.py
```

This normalizes the real records, replays them across a simulated 48-hour
timeline with injected scenarios (clean / late-file / leakage / duplicates /
amount-corruption), reconciles hourly, and computes verdicts.

Outputs land in `out/`:

- `hourly_verdicts.csv` — discrepancy vector + verdict/score/drivers per hour
- `injection_log.csv` — ground truth of injected scenarios (to validate against)

## Dashboard

`demo/dashboard_template.jsx` is a React component with a `__DATA__` placeholder.
The build step that writes `out/dashboard_data.json` and substitutes it into the
template is **not yet wired into the pipeline** — see the next-steps section in
[CLAUDE.md](CLAUDE.md). The full UI is planned.

## Development

```bash
make setup-dev        # installs pytest + ruff
make lint             # ruff check
make clean            # remove generated outputs and caches
```
