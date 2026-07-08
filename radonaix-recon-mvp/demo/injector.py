"""
RADONaix Recon MVP - Layer 2c: Scenario Injector

Replays the REAL AIR records (structure, keys, amounts preserved) across a
simulated 48-hour timeline with a diurnal traffic curve, then injects
controlled discrepancy scenarios into chosen hours so the demo can show how
the IT2+CWW layer classifies each situation.

Scenarios injected (per record type, on the simulated timeline):
    CLEAN          : raw == proc (baseline hours)
    LATE_FILE      : a slice of proc records shifted to the NEXT hour
                     -> gap with high catch-up  -> latency, not leakage
    LEAKAGE        : a slice of raw records with proc counterpart REMOVED
                     -> gap with zero catch-up  -> real leakage
    DUPLICATES     : a slice of proc records duplicated
    AMT_CORRUPT    : matched records with proc amount perturbed
"""
from __future__ import annotations

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)

# hour-of-day traffic weights (diurnal curve, peak evening)
DIURNAL = np.array(
    [0.15, 0.10, 0.08, 0.07, 0.08, 0.12, 0.25, 0.45, 0.60, 0.70, 0.75, 0.80,
     0.85, 0.80, 0.75, 0.72, 0.78, 0.88, 1.00, 0.98, 0.90, 0.70, 0.45, 0.25]
)

# (day, hour) -> scenario; everything else is CLEAN
SCENARIOS = {
    (0, 10): ("LATE_FILE", 0.06),     # 6% of proc arrives next hour
    (0, 19): ("LEAKAGE", 0.025),      # 2.5% real leakage at peak
    (1, 3):  ("LEAKAGE", 0.02),       # 2% leakage in a quiet hour
    (1, 11): ("DUPLICATES", 0.03),
    (1, 14): ("AMT_CORRUPT", 0.02),
    (1, 19): ("LEAKAGE", 0.12),       # major leakage event at peak
    (0, 15): ("LATE_FILE", 0.15),     # heavy late file
}


def build_timeline(canon: pd.DataFrame, days: int = 2, start: str = "2026-07-01") -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (simulated canonical frame, injection log)."""
    base = pd.Timestamp(start, tz="UTC")
    raw = canon[canon["side"] == "raw"]
    matched_keys = set(canon[canon["side"] == "proc"]["key"])

    sim_rows = []
    log = []
    for rtype, pool_df in raw.groupby("record_type"):
        # only replay records that HAVE a proc counterpart, so baseline is clean
        pool = pool_df[pool_df["key"].isin(matched_keys)].reset_index(drop=True)
        npool = len(pool)
        for day in range(days):
            for hour in range(24):
                ts = base + pd.Timedelta(days=day, hours=hour)
                n = max(8, int(npool * DIURNAL[hour]))
                idx = RNG.choice(npool, size=n, replace=True)
                sample = pool.iloc[idx].copy()
                # re-key so every replayed instance is globally unique
                # (tag + running instance number prevents accidental duplicates
                # when the same pool record is drawn twice in one hour)
                tag = f"{day}{hour:02d}"
                inst = np.arange(n).astype(str)
                sample["txn_id"] = sample["txn_id"] + tag + inst
                sample["key"] = sample["txn_id"] + "|" + sample["seq_no"]
                jitter = pd.to_timedelta(RNG.integers(0, 3600, size=n), unit="s")
                sample["event_ts_utc"] = ts + jitter
                sample["hour_bucket"] = ts

                raw_h = sample.copy()
                raw_h["side"] = "raw"
                proc_h = sample.copy()
                proc_h["side"] = "proc"

                scen, mag = SCENARIOS.get((day, hour), ("CLEAN", 0.0))
                k = max(1, round(n * mag)) if scen != "CLEAN" else 0
                if scen == "LEAKAGE" and k > 0:
                    proc_h = proc_h.iloc[k:]  # drop k proc records forever
                elif scen == "LATE_FILE" and k > 0:
                    late = proc_h.iloc[:k].copy()
                    late["hour_bucket"] = ts + pd.Timedelta(hours=1)
                    late["event_ts_utc"] = late["event_ts_utc"] + pd.Timedelta(hours=1)
                    proc_h = pd.concat([proc_h.iloc[k:], late])
                elif scen == "DUPLICATES" and k > 0:
                    proc_h = pd.concat([proc_h, proc_h.iloc[:k]])
                elif scen == "AMT_CORRUPT" and k > 0:
                    proc_h = proc_h.copy()
                    proc_h.iloc[:k, proc_h.columns.get_loc("amount")] = (
                        proc_h.iloc[:k]["amount"] * 0.5
                    )
                if scen != "CLEAN":
                    log.append({"record_type": rtype, "day": day, "hour": hour,
                                "hour_ts": ts, "scenario": scen, "records_affected": k})
                sim_rows.append(raw_h)
                sim_rows.append(proc_h)

    sim = pd.concat(sim_rows, ignore_index=True)
    return sim, pd.DataFrame(log)
