"""RADONaix Recon MVP - full pipeline runner."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd

from recon.normalize import load_all
from recon.engine import reconcile_hourly
from fuzzy.verdict import run_verdicts
from demo.injector import build_timeline

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> None:
    canon = load_all(os.path.join(ROOT, "data"))
    print(f"[1/4] normalized real records: {len(canon)}")

    sim, log = build_timeline(canon, days=2)
    print(f"[2/4] simulated 48h timeline: {len(sim)} records, {len(log)} injected scenarios")

    hourly = reconcile_hourly(sim)
    print(f"[3/4] hourly reconciliation: {len(hourly)} (record_type, hour) buckets")

    verdicts = run_verdicts(hourly)
    print("[4/4] IT2+CWW verdicts computed")

    out = os.path.join(ROOT, "out")
    os.makedirs(out, exist_ok=True)
    v = verdicts.copy()
    v["drivers"] = v["drivers"].apply(
        lambda ds: "; ".join(
            f"{'&'.join(k + '=' + t for k, t in d['rule'].items())}->{d['consequent']}"
            for d in ds
        )
    )
    v.to_csv(os.path.join(out, "hourly_verdicts.csv"), index=False)
    log.to_csv(os.path.join(out, "injection_log.csv"), index=False)

    # console summary: injected hours vs verdicts
    print("\n=== Verdict distribution ===")
    print(v["verdict"].value_counts().to_string())
    print("\n=== Injected scenario hours vs verdicts ===")
    merged = log.merge(
        v, left_on=["record_type", "hour_ts"], right_on=["record_type", "hour"], how="left"
    )
    cols = ["record_type", "scenario", "hour_ts", "count_gap_pct", "value_gap_pct",
            "dup_rate_pct", "catchup_rate_pct", "traffic_pct", "score", "verdict"]
    print(merged[cols].to_string(index=False))

    # sanity: a few clean hours
    clean = v[~v["hour"].isin(set(log["hour_ts"]))].head(6)
    print("\n=== Sample clean hours ===")
    print(clean[["record_type", "hour", "count_gap_pct", "value_gap_pct", "score", "verdict"]].to_string(index=False))


if __name__ == "__main__":
    main()
