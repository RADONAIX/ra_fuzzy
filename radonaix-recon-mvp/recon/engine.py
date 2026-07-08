"""
RADONaix Recon MVP - Layer 1b: Hourly Reconciliation Engine

Deterministic, auditable layer. For each (record_type, hour_bucket) it matches
raw vs processed on the confirmed composite key (txn_id + local_seq_no) and
emits the discrepancy vector consumed by the IT2+CWW verdict engine (Layer 2).

Discrepancy vector per (record_type, hour):
    raw_count, proc_count
    matched            : keys present on both sides (any hour on proc side)
    raw_only           : raw keys never seen in proc
    catchup            : raw keys matched by a proc record in a LATER hour bucket
                         (late mediation -> latency, not leakage)
    proc_only          : proc keys never seen in raw (dup/ghost risk)
    dup_count          : duplicate keys within proc side
    count_gap_pct      : unexplained missing raw records / raw_count * 100
                         (raw_only after catch-up credit)
    value_gap_pct      : |sum(raw amt) - sum(proc amt matched)| / |sum(raw amt)| * 100
                         computed on absolute amounts
    dup_rate_pct       : proc duplicates / proc_count * 100
    catchup_rate_pct   : catchup / (catchup + raw_only_final) * 100 (0 if no gap)
    amt_mismatch       : matched keys whose amounts differ beyond tolerance
    traffic_level      : raw_count (context input for the fuzzy layer)
"""
from __future__ import annotations

import pandas as pd

AMOUNT_TOL = 0.005  # currency tolerance for amount comparison


def reconcile_hourly(canon: pd.DataFrame) -> pd.DataFrame:
    """canon: canonical frame from normalize.load_all() (or the scenario injector)."""
    results = []
    for rtype, grp in canon.groupby("record_type"):
        raw = grp[grp["side"] == "raw"]
        proc = grp[grp["side"] == "proc"]

        # proc-side lookup: key -> (first hour seen, amount), plus dup detection
        proc_dedup = proc.sort_values("event_ts_utc").drop_duplicates("key", keep="first")
        proc_hours = proc_dedup.set_index("key")["hour_bucket"]
        proc_amt = proc_dedup.set_index("key")["amount"]
        dup_keys_by_hour = (
            proc[proc.duplicated("key", keep="first")].groupby("hour_bucket").size()
        )

        raw_keys = set(raw["key"])
        proc_only_by_hour = (
            proc_dedup[~proc_dedup["key"].isin(raw_keys)].groupby("hour_bucket").size()
        )

        for hour, rh in raw.groupby("hour_bucket"):
            raw_count = len(rh)
            matched_hours = rh["key"].map(proc_hours)  # NaT if never matched
            is_matched = matched_hours.notna()
            is_catchup = is_matched & (matched_hours > hour)  # matched, but in a later hour
            matched_same = is_matched & ~is_catchup

            raw_only_final = int((~is_matched).sum())
            catchup = int(is_catchup.sum())
            matched = int(is_matched.sum())

            # amount comparison on matched keys
            pa = rh["key"].map(proc_amt)
            amt_mismatch = int(
                (is_matched & ((rh["amount"] - pa).abs() > AMOUNT_TOL)).sum()
            )

            raw_val = rh["amount"].abs().sum()
            matched_val = pa[is_matched].abs().sum()
            value_gap_pct = (
                abs(raw_val - matched_val) / raw_val * 100 if raw_val > 0 else 0.0
            )

            proc_count = int((proc["hour_bucket"] == hour).sum())
            dups = int(dup_keys_by_hour.get(hour, 0))
            proc_only = int(proc_only_by_hour.get(hour, 0))

            # count gap = everything not matched in the SAME hour;
            # catchup_rate then tells how much of that gap is explained by
            # late arrival (latency) vs never arriving (potential leakage).
            total_gap = catchup + raw_only_final
            count_gap_pct = total_gap / raw_count * 100 if raw_count else 0.0
            catchup_rate_pct = catchup / total_gap * 100 if total_gap else 0.0
            dup_rate_pct = dups / proc_count * 100 if proc_count else 0.0
            mismatch_rate_pct = amt_mismatch / matched * 100 if matched else 0.0

            results.append(
                {
                    "record_type": rtype,
                    "hour": hour,
                    "raw_count": raw_count,
                    "proc_count": proc_count,
                    "matched": matched,
                    "matched_same_hour": int(matched_same.sum()),
                    "catchup": catchup,
                    "raw_only": raw_only_final,
                    "proc_only": proc_only,
                    "dup_count": dups,
                    "amt_mismatch": amt_mismatch,
                    "count_gap_pct": round(count_gap_pct, 3),
                    "value_gap_pct": round(value_gap_pct, 3),
                    "dup_rate_pct": round(dup_rate_pct, 3),
                    "catchup_rate_pct": round(catchup_rate_pct, 3),
                    "mismatch_rate_pct": round(mismatch_rate_pct, 3),
                    "traffic_level": raw_count,
                }
            )
    return (
        pd.DataFrame(results)
        .sort_values(["record_type", "hour"])
        .reset_index(drop=True)
    )


if __name__ == "__main__":
    import sys, os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from recon.normalize import load_all

    canon = load_all(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"))
    vec = reconcile_hourly(canon)
    print(vec.to_string(index=False))
