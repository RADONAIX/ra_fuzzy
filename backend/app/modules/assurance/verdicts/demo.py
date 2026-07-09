"""Synthetic verdict data for demos without a live ClickHouse.

Generates a deterministic hourly timeline of discrepancy vectors (diurnal traffic
curve + a handful of injected events) for two record types. The vectors are
scored by the *real* IT2 + CWW engine in ``service``, so a demo shows genuine
verdicts across all four classes — only the input data is synthetic.

Gated behind ``settings.verdicts_demo_mode`` (off in production).
"""

from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta

# Hour-of-day traffic weights (evening peak), from the recon MVP injector.
_DIURNAL = [
    0.15, 0.10, 0.08, 0.07, 0.08, 0.12, 0.25, 0.45, 0.60, 0.70, 0.75, 0.80,
    0.85, 0.80, 0.75, 0.72, 0.78, 0.88, 1.00, 0.98, 0.90, 0.70, 0.45, 0.25,
]

_RTYPES = ("REFILL", "ADJUSTMENT")
_BASE = {"REFILL": 2200, "ADJUSTMENT": 900}  # peak-hour raw volume per type

# Injected events, keyed by (hours_ago, record_type). hours_ago = 0 is the most
# recent hour. Placed within the last ~20h so the 24h window shows the spread.
# Each value overrides the crisp % metrics; omitted metrics stay at clean noise.
_EVENTS: dict[tuple[int, str], dict[str, float]] = {
    (2, "REFILL"): {"count_gap": 12.4, "value_gap": 11.8, "catchup": 4.0},   # peak leakage -> Critical
    (3, "ADJUSTMENT"): {"count_gap": 2.6, "value_gap": 3.1, "catchup": 0.0}, # leakage -> Suspect
    (5, "REFILL"): {"dup_rate": 3.0},                                        # duplicates -> Suspect
    (7, "ADJUSTMENT"): {"mismatch": 2.6, "value_gap": 0.9},                  # amount corruption -> Suspect
    (9, "REFILL"): {"count_gap": 6.1, "catchup": 100.0},                     # late file (all catches up) -> Watch/Healthy
    (12, "ADJUSTMENT"): {"count_gap": 1.6, "catchup": 18.0},                 # small real gap -> Watch
    (14, "REFILL"): {"count_gap": 5.2, "catchup": 8.0},                      # moderate real gap -> Suspect
    (20, "ADJUSTMENT"): {"count_gap": 9.3, "value_gap": 8.4, "catchup": 2.0},# large gap -> Critical/Suspect
}


def generate_demo_vectors(hours: int) -> list[tuple[str, datetime, dict]]:
    """Return [(record_type, hour_ts_utc, vector_dict)] for the last ``hours``."""
    rng = random.Random(42)
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    hourlist = [now - timedelta(hours=hours - 1 - i) for i in range(hours)]

    # First pass: raw counts per (type, hour), so traffic_pct uses the real peak.
    raw_counts: dict[str, list[int]] = {rt: [] for rt in _RTYPES}
    for hour in hourlist:
        d = _DIURNAL[hour.hour]
        for rt in _RTYPES:
            raw_counts[rt].append(max(20, int(_BASE[rt] * d) + rng.randint(-40, 40)))
    peak = {rt: max(counts) for rt, counts in raw_counts.items()}

    out: list[tuple[str, datetime, dict]] = []
    for idx, hour in enumerate(hourlist):
        hours_ago = hours - 1 - idx
        for rt in _RTYPES:
            rc = raw_counts[rt][idx]
            ev = _EVENTS.get((hours_ago, rt), {})

            count_gap = ev.get("count_gap", round(rng.uniform(0.0, 0.4), 3))
            value_gap = ev.get("value_gap", round(rng.uniform(0.0, 0.3), 3))
            dup_rate = ev.get("dup_rate", 0.0)
            mismatch = ev.get("mismatch", 0.0)
            catchup_rate = ev.get("catchup", round(rng.uniform(0.0, 15.0), 1) if count_gap > 0.5 else 0.0)
            traffic_pct = round(rc / peak[rt] * 100, 1) if peak[rt] else 0.0

            # Derive plausible display counts from the % metrics.
            gap_records = round(rc * count_gap / 100)
            catchup_ct = round(gap_records * catchup_rate / 100)
            raw_only = max(0, gap_records - catchup_ct)
            matched = rc - raw_only
            dup_ct = round(matched * dup_rate / 100)
            amt_mis = round(matched * mismatch / 100)
            proc_only = rng.randint(0, 2)

            out.append(
                (
                    rt,
                    hour,
                    {
                        "raw_count": rc,
                        "proc_count": matched + dup_ct + proc_only,
                        "matched": matched,
                        "catchup": catchup_ct,
                        "raw_only": raw_only,
                        "proc_only": proc_only,
                        "dup_count": dup_ct,
                        "amt_mismatch": amt_mis,
                        "count_gap_pct": count_gap,
                        "value_gap_pct": value_gap,
                        "dup_rate_pct": dup_rate,
                        "catchup_rate_pct": catchup_rate,
                        "mismatch_rate_pct": mismatch,
                        "traffic_pct": traffic_pct,
                    },
                )
            )
    return out


# ---------------------------------------------------------------------------
# Generic, profile-driven demo — returns (entity, hour, metrics, context) where
# `metrics` keys are exactly the profile's fuzzy inputs.
# ---------------------------------------------------------------------------
def _recon_profile_demo(hours: int) -> list[tuple[str, datetime, dict, dict]]:
    out = []
    for rt, hour, vec in generate_demo_vectors(hours):
        metrics = {
            "count_gap": vec["count_gap_pct"],
            "value_gap": vec["value_gap_pct"],
            "dup_rate": vec["dup_rate_pct"],
            "catchup": vec["catchup_rate_pct"],
            "mismatch": vec["mismatch_rate_pct"],
            "traffic": vec["traffic_pct"],
        }
        context = {
            "raw_count": vec["raw_count"],
            "proc_count": vec["proc_count"],
            "matched": vec["matched"],
            "catchup": vec["catchup"],
            "raw_only": vec["raw_only"],
            "proc_only": vec["proc_only"],
            "dup_count": vec["dup_count"],
            "amt_mismatch": vec["amt_mismatch"],
        }
        out.append((rt, hour, metrics, context))
    return out


# File-sequence events, keyed by (hours_ago, source). Override the crisp metrics.
_FILESEQ_BASE = {"AIR": 120, "SDP": 80}  # peak-hour files per source
_FILESEQ_EVENTS: dict[tuple[int, str], dict[str, float]] = {
    (2, "AIR"): {"seq_gap": 22.0, "delayed_share": 4.0, "gap_span": 18.0},   # big contiguous hole -> Critical
    (4, "SDP"): {"seq_gap": 6.2, "delayed_share": 92.0},                     # delayed batch (caught up) -> Watch/Healthy
    (6, "AIR"): {"out_of_order": 3.4},                                       # ordering spike -> Watch
    (8, "SDP"): {"seq_gap": 5.1, "delayed_share": 10.0},                     # moderate real gap -> Suspect
    (11, "AIR"): {"seq_gap": 2.3, "delayed_share": 14.0},                    # small real gap at traffic -> Watch/Suspect
    (16, "SDP"): {"seq_gap": 9.4, "delayed_share": 8.0, "gap_span": 7.0},    # large gap -> Critical/Suspect
}


def _file_sequence_demo(hours: int) -> list[tuple[str, datetime, dict, dict]]:
    rng = random.Random(7)
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    hourlist = [now - timedelta(hours=hours - 1 - i) for i in range(hours)]
    sources = ("AIR", "SDP")

    expected_by: dict[str, list[int]] = {s: [] for s in sources}
    for hour in hourlist:
        d = _DIURNAL[hour.hour]
        for s in sources:
            expected_by[s].append(max(4, int(_FILESEQ_BASE[s] * d) + rng.randint(-3, 3)))
    peak = {s: max(v) for s, v in expected_by.items()}

    out: list[tuple[str, datetime, dict, dict]] = []
    for idx, hour in enumerate(hourlist):
        hours_ago = hours - 1 - idx
        for s in sources:
            expected = expected_by[s][idx]
            ev = _FILESEQ_EVENTS.get((hours_ago, s), {})
            seq_gap = ev.get("seq_gap", round(rng.uniform(0.0, 0.4), 3))
            delayed_share = ev.get("delayed_share", round(rng.uniform(0.0, 20.0), 1) if seq_gap > 0.5 else 0.0)
            out_of_order = ev.get("out_of_order", 0.0)
            gap_span = ev.get("gap_span", float(rng.randint(0, 2)))
            traffic_pct = round(expected / peak[s] * 100, 1) if peak[s] else 0.0

            gap_files = round(expected * seq_gap / 100)
            delayed_ct = round(gap_files * delayed_share / 100)
            missing_ct = max(0, gap_files - delayed_ct)
            received = expected - missing_ct
            ooo_ct = round(received * out_of_order / 100)

            metrics = {
                "seq_gap": seq_gap,
                "delayed_share": delayed_share,
                "out_of_order": out_of_order,
                "gap_span": gap_span,
                "traffic": traffic_pct,
            }
            context = {
                "expected": expected,
                "received": received,
                "missing": missing_ct,
                "delayed": delayed_ct,
                "out_of_order": ooo_ct,
                "max_gap": int(gap_span),
            }
            out.append((s, hour, metrics, context))
    return out


# Cross-recon events, keyed by (hours_ago, event_type). Override crisp metrics.
_CROSS_BASE = {"RECHARGE": 900, "ADJUSTMENT": 350, "USAGE": 1400}  # peak events/hour
_CROSS_EVENTS: dict[tuple[int, str], dict[str, float]] = {
    (2, "RECHARGE"): {"field_drift": 12.0},                              # value drift -> Critical
    (4, "USAGE"): {"missing_rate": 6.0, "pending_share": 92.0},          # in-flight batch -> Watch/Healthy
    (6, "ADJUSTMENT"): {"unexpected_rate": 3.2},                         # ghost records -> Suspect
    (8, "USAGE"): {"missing_rate": 5.0, "pending_share": 10.0},          # real divergence -> Suspect
    (11, "RECHARGE"): {"missing_rate": 18.0, "pending_share": 6.0},      # large divergence -> Critical
    (16, "ADJUSTMENT"): {"field_drift": 4.0},                            # moderate field drift -> Suspect
}


def _cross_recon_demo(hours: int) -> list[tuple[str, datetime, dict, dict]]:
    rng = random.Random(11)
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    hourlist = [now - timedelta(hours=hours - 1 - i) for i in range(hours)]
    etypes = tuple(_CROSS_BASE)

    expected_by: dict[str, list[int]] = {e: [] for e in etypes}
    for hour in hourlist:
        d = _DIURNAL[hour.hour]
        for e in etypes:
            expected_by[e].append(max(10, int(_CROSS_BASE[e] * d) + rng.randint(-20, 20)))
    peak = {e: max(v) for e, v in expected_by.items()}

    out: list[tuple[str, datetime, dict, dict]] = []
    for idx, hour in enumerate(hourlist):
        hours_ago = hours - 1 - idx
        for e in etypes:
            expected = expected_by[e][idx]
            ev = _CROSS_EVENTS.get((hours_ago, e), {})
            missing_rate = ev.get("missing_rate", round(rng.uniform(0.0, 0.4), 3))
            pending_share = ev.get("pending_share", round(rng.uniform(0.0, 20.0), 1) if missing_rate > 0.5 else 0.0)
            unexpected_rate = ev.get("unexpected_rate", 0.0)
            field_drift = ev.get("field_drift", round(rng.uniform(0.0, 0.3), 3))
            traffic_pct = round(expected / peak[e] * 100, 1) if peak[e] else 0.0

            div = round(expected * missing_rate / 100)
            pending_ct = round(div * pending_share / 100)
            missing_ct = max(0, div - pending_ct)
            matched = expected - missing_ct
            unexpected_ct = round(matched * unexpected_rate / 100)
            drift_ct = round(matched * field_drift / 100)

            metrics = {
                "missing_rate": missing_rate,
                "pending_share": pending_share,
                "unexpected_rate": unexpected_rate,
                "field_drift": field_drift,
                "traffic": traffic_pct,
            }
            context = {
                "air_events": expected,
                "matched": matched,
                "missing": missing_ct,
                "pending": pending_ct,
                "unexpected": unexpected_ct,
                "field_mismatch": drift_ct,
            }
            out.append((e, hour, metrics, context))
    return out


_PROFILE_DEMOS = {
    "recon": _recon_profile_demo,
    "file_sequence": _file_sequence_demo,
    "cross_recon": _cross_recon_demo,
}


def generate_profile_demo(profile_key: str, hours: int) -> list[tuple[str, datetime, dict, dict]]:
    """Return [(entity, hour, metrics, context)] for a profile's demo timeline."""
    gen = _PROFILE_DEMOS.get(profile_key)
    return gen(hours) if gen else []
