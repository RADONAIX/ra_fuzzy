# CLAUDE.md — RADONaix RA Reconciliation MVP

Context for AI-assisted development. Read this before touching code.

## What this is

Hourly **revenue-assurance reconciliation** for an Ericsson **AIR** feed:
compare the network side (raw, pre-mediation) against the mediation side
(processed, post-mediation), and instead of a rigid threshold alarm, classify
each hour with an **Interval Type-2 (IT2) fuzzy system** and a
**Computing-With-Words (CWW)** decoder that outputs a plain verdict:
`Healthy / Watch / Suspect / Critical`.

The reason fuzzy earns its place: the same % gap means different things at 3am
vs peak, and a gap that catches up next hour is *latency, not leakage*. Crisp
thresholds either false-alarm or miss real leakage. This system reasons over the
whole discrepancy vector with context, and is honest about boundary uncertainty.

## Core architectural rule (do not violate)

**Don't fuzzify the counting — fuzzify the verdict.**

- **Layer 1 (`recon/`)** is deterministic, exact, auditable. It produces the
  discrepancy vector. No fuzziness lives here.
- **Layer 2 (`fuzzy/`)** is the IT2 + CWW verdict engine. It consumes Layer 1's
  vector and never touches raw records.

Keep that boundary. If a change blurs it, it's the wrong change.

## Layout

```
radonaix-recon-mvp/
├── recon/
│   ├── normalize.py   # 4 CSV extracts -> one canonical schema
│   └── engine.py      # canonical -> per (record_type, hour) discrepancy vector
├── fuzzy/
│   ├── it2.py         # IT2 trapezoids, rule firing, Nie-Tan reduction, Jaccard
│   └── verdict.py     # input/output vocab (FOUs), rule base, CWW decoder
├── demo/
│   ├── injector.py    # replays real records across simulated 48h + scenarios
│   ├── run_demo.py    # full pipeline runner + console report
│   └── dashboard_template.jsx  # React dashboard; __DATA__ placeholder
├── data/              # the 5 provided CSVs (read-only source)
└── out/               # generated: verdicts csv, injection log, dashboard json
```

Run everything: `python3 demo/run_demo.py` (deps: pandas, numpy only).

## Confirmed decisions — treat as settled

1. **Match key (composite, both sides):** `origin_txn_id` + `local_seq_no`.
   - raw refill: `air_rfl_rec_origin_txn_id` + `air_rfl_rec_local_seq_no`
   - raw adjustment: `air_adj_origin_transaction_id` + `air_adj_local_sequence_number`
   - processed: `air_proc_origin_tran_id` + `air_proc_local_seq_no`
   - Validated unique on all four extracts, 0 duplicates.

2. **Record type comes from the source file, not `air_proc_cdr_type_main`**
   (which reads `AA` in both processed extracts). RR extract = REFILL,
   AA extract = ADJUSTMENT.

3. **Amount field (validated 100% vs raw on both types):**
   - RR processed: `tran_amt` is zeroed; the real amount is in `air_proc_extra4`.
   - AA processed: `tran_amt` is usually set; falls back to `extra4` when 0.
   - Implemented as `amount = tran_amt if |tran_amt| >= 0.005 else extra4`.
   - Compare on **absolute** amounts (adjustments can be negative).

4. **Timezone:** raw AIR timestamps are UTC (`YYYYMMDDHHMMSS+0000`). Processed
   `origin_time_stamp` is **local (+05:30, Asia/Kolkata)** with no offset —
   localize then convert to UTC before bucketing. Everything buckets on UTC.

5. **Hourly bucket:** raw `origin_timestamp` floored to the hour (UTC).

6. **Relationship is 1:1** (confirmed). If a future feed splits/aggregates,
   the count-gap definition must be revisited before trusting verdicts.

## Data quirks found (flag to MTN / RA team, already handled in code)

- The recon DB stores `proc_txn_id` as **float** → 18-digit IDs lose precision
  as float64 and cause false mismatches at scale. This engine treats all IDs as
  **strings** throughout. Do not revert to numeric IDs.
- The provided recon table is **raw-driven only** (`raw_present=1` everywhere),
  so it cannot detect **PROC_ONLY** records (duplicates / ghosts). This engine
  computes both directions.
- The provided extract is a single ~6-minute window (one hour bucket), and
  356/357 of its unmatched records fall **outside** the processed files' time
  coverage — i.e. a file-boundary effect, not leakage. This is exactly why the
  demo timeline comes from the injector, not the raw extract alone.

## Layer 1 discrepancy vector (output of `reconcile_hourly`)

Per `(record_type, hour)`:
`raw_count, proc_count, matched, matched_same_hour, catchup, raw_only,
proc_only, dup_count, amt_mismatch, count_gap_pct, value_gap_pct, dup_rate_pct,
catchup_rate_pct, mismatch_rate_pct, traffic_level`

Key definitions:
- **catchup** = raw keys matched by a proc record in a *later* hour bucket
  (late mediation → latency).
- **count_gap_pct** = total same-hour gap `(catchup + raw_only) / raw_count`.
- **catchup_rate_pct** = `catchup / (catchup + raw_only)` → how much of the gap
  is explained by lateness. High catch-up should pull verdicts *down*.
- **value_gap_pct** = `|Σ raw_amt − Σ matched_proc_amt| / |Σ raw_amt|` on abs amounts.
- **mismatch_rate_pct** = matched keys whose amounts disagree beyond tolerance
  (`AMOUNT_TOL = 0.005`).
- **traffic_level** = `raw_count`; `run_verdicts` converts it to `traffic_pct`
  (% of that record_type's daily peak) as the fuzzy context input.

## Layer 2 — IT2 + CWW design

**Fuzzy inputs** (all crisp, from Layer 1): `count_gap, value_gap, dup_rate,
catchup, mismatch, traffic`. Vocab lives in `fuzzy/verdict.py::VOCAB`.

**IT2 membership** (`fuzzy/it2.py::IT2Trap`): each linguistic term has an
**upper** trapezoid (height 1, generous reading) and a **lower** trapezoid
(height `lower_h≈0.9`, strict reading). The gap between them is the Footprint of
Uncertainty (FOU) — this is what makes it type-2 and encodes that the boundary
itself is uncertain.

**Inference:** min t-norm → firing interval `[f_lo, f_up]` per rule.

**Type reduction:** **Nie-Tan** (closed-form, fast — MVP choice). Karnik-Mendel
is the drop-in upgrade if the exact centroid interval is needed. The reduced
`interval` is surfaced as the dashboard's uncertainty band; the Nie-Tan point is
the `score`.

**CWW decoder** (`_decode_word`): build a small IT2 set around the reduced
interval, pick the `CODEBOOK` word with max **Jaccard** similarity. Codebook
words sit on a 0–100 risk scale: Healthy / Watch / Suspect / Critical.

**Rule base** (`fuzzy/verdict.py::RULES`, hand-crafted for MVP): encodes analyst
intuition — catch-up downgrades gaps, peak traffic escalates, value gap outranks
count gap, duplicates and amount mismatch are independent risks. Rules carry
weights.

## Scenario injector (`demo/injector.py`)

Replays only raw records that HAVE a proc counterpart (so baseline is clean),
re-keyed per hour instance to stay globally unique, across a diurnal 48h curve.
`SCENARIOS[(day, hour)]` injects: `CLEAN, LATE_FILE, LEAKAGE, DUPLICATES,
AMT_CORRUPT`. Seed is fixed (`RNG = default_rng(42)`) for reproducible demos.
The injection log is ground truth to validate verdicts against.

## Dashboard

`demo/dashboard_template.jsx` has a `__DATA__` placeholder. `run_demo.py`-adjacent
export writes `out/dashboard_data.json`; the build step string-replaces
`__DATA__` with that JSON to produce the final `.jsx`. Palette is RADONaix
navy/cyan/steel; verdict colors are fixed in the `C` object. Keep the verdict
strip as the signature element and the IF/THEN rule trace as the explainability.

## Working conventions (owner: Platum)

- Production-grade, minimal filler. Confirm reconciliation-key / semantic
  decisions in chat **before** writing engine code — don't guess field meanings.
- Source strictly from provided data; validate any field-mapping hypothesis
  against the real records (as done for `extra4`) before committing it.
- Keep Layer 1 exact and auditable; keep fuzzy logic confined to Layer 2.
- Verdicts are **triage** — they rank attention, they don't replace root-cause
  investigation. Don't let the fuzzy layer make destructive or billing decisions.

## Sensible next steps (not yet done)

- Tune FOUs against analyst-labelled hours; add the survey-based
  **Interval Approach / Enhanced IA** to derive the codebook instead of hand FOUs.
- Swap Nie-Tan → Karnik-Mendel where exactness matters.
- Add PROC_ONLY-driven duplicate/ghost verdicts as a first-class scenario.
- Wire native ASN.1/BER (raw `.ber`) and processed `.dat` taps for production,
  replacing the CSV loaders in `recon/normalize.py`.
- Persist vectors + verdicts to Postgres/ClickHouse; schedule hourly (the MVP
  uses a batch runner, not a real scheduler).
- Multi-feed support (this MVP is REFILL + ADJUSTMENT on one AIR node).
