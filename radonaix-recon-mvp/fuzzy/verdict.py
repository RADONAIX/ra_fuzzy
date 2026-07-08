"""
RADONaix Recon MVP - Layer 2b: IT2 + CWW Verdict Engine

Consumes the hourly discrepancy vector from recon.engine and emits, per
(record_type, hour):

    verdict     : Healthy | Watch | Suspect | Critical  (CWW word)
    score       : 0-100 crisp risk (Nie-Tan)
    band        : (lo, hi) type-reduced interval -> uncertainty band
    similarity  : Jaccard similarity of output to the chosen codebook word
    drivers     : top firing rules (explainability)

Inputs to the fuzzy system (all already crisp and auditable):
    count_gap   : unexplained count gap % (after catch-up credit)
    value_gap   : value gap %
    dup_rate    : duplicate rate % on processed side
    catchup     : % of the hour's gap explained by late arrival
    traffic     : hour traffic as % of the day's peak hour (context)
"""
from __future__ import annotations

import pandas as pd

from fuzzy.it2 import IT2Trap, Rule, nie_tan, jaccard_it2

# ---------------------------------------------------------------------------
# Input vocabulary. Upper trapezoid = generous reading, lower = strict reading;
# the gap between them (FOU) encodes "the boundary itself is uncertain".
# Gap scales are % of records/value; traffic is % of daily peak.
# ---------------------------------------------------------------------------
VOCAB: dict[str, dict[str, IT2Trap]] = {
    "count_gap": {
        "negligible": IT2Trap("negligible", (0, 0, 0.3, 1.0), (0, 0, 0.2, 0.6)),
        "small":      IT2Trap("small", (0.2, 0.8, 2.0, 4.0), (0.5, 1.0, 1.6, 3.0)),
        "moderate":   IT2Trap("moderate", (2.0, 4.0, 8.0, 15.0), (3.0, 5.0, 7.0, 12.0)),
        "large":      IT2Trap("large", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
    },
    "value_gap": {
        "negligible": IT2Trap("negligible", (0, 0, 0.3, 1.0), (0, 0, 0.2, 0.6)),
        "small":      IT2Trap("small", (0.2, 0.8, 2.0, 4.0), (0.5, 1.0, 1.6, 3.0)),
        "moderate":   IT2Trap("moderate", (2.0, 4.0, 8.0, 15.0), (3.0, 5.0, 7.0, 12.0)),
        "large":      IT2Trap("large", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
    },
    "dup_rate": {
        "low":  IT2Trap("low", (0, 0, 0.2, 1.0), (0, 0, 0.1, 0.5)),
        "high": IT2Trap("high", (0.2, 1.5, 100, 100), (0.8, 3.0, 100, 100)),
    },
    "catchup": {
        "low":  IT2Trap("low", (0, 0, 30, 60), (0, 0, 20, 45)),
        "high": IT2Trap("high", (40, 70, 100, 100), (55, 85, 100, 100)),
    },
    "mismatch": {
        "low":  IT2Trap("low", (0, 0, 0.2, 1.0), (0, 0, 0.1, 0.5)),
        "high": IT2Trap("high", (0.3, 2.0, 100, 100), (1.0, 4.0, 100, 100)),
    },
    "traffic": {
        "quiet": IT2Trap("quiet", (0, 0, 15, 35), (0, 0, 10, 25)),
        "normal": IT2Trap("normal", (15, 35, 60, 80), (25, 42, 55, 70)),
        "peak":  IT2Trap("peak", (60, 80, 100, 100), (70, 90, 100, 100)),
    },
}

# Output codebook on the 0-100 risk scale (CWW words)
CODEBOOK: dict[str, IT2Trap] = {
    "Healthy":  IT2Trap("Healthy", (0, 0, 10, 30), (0, 0, 6, 20)),
    "Watch":    IT2Trap("Watch", (15, 30, 45, 60), (22, 34, 41, 52)),
    "Suspect":  IT2Trap("Suspect", (45, 60, 72, 85), (52, 63, 69, 78)),
    "Critical": IT2Trap("Critical", (72, 85, 100, 100), (80, 92, 100, 100)),
}

# ---------------------------------------------------------------------------
# Rule base (hand-crafted for MVP). RA-analyst intuition encoded:
#   - a gap that catches up next hour is latency, not leakage
#   - the same gap at peak traffic risks more revenue -> escalate
#   - value gap outranks count gap (revenue is what leaks)
#   - duplicates are an overbilling/regulatory risk on their own
# ---------------------------------------------------------------------------
RULES: list[Rule] = [
    # clean hours
    Rule({"count_gap": "negligible", "value_gap": "negligible", "dup_rate": "low"}, "Healthy"),
    # small gaps: catch-up decides
    Rule({"count_gap": "small", "catchup": "high"}, "Healthy", 0.9),
    Rule({"count_gap": "small", "catchup": "low", "traffic": "quiet"}, "Watch"),
    Rule({"count_gap": "small", "catchup": "low", "traffic": "normal"}, "Watch"),
    Rule({"count_gap": "small", "catchup": "low", "traffic": "peak"}, "Suspect"),
    # moderate gaps
    Rule({"count_gap": "moderate", "catchup": "high"}, "Watch"),
    Rule({"count_gap": "moderate", "catchup": "low"}, "Suspect"),
    Rule({"count_gap": "moderate", "catchup": "low", "traffic": "peak"}, "Critical", 0.8),
    # large gaps
    Rule({"count_gap": "large", "catchup": "high"}, "Suspect"),
    Rule({"count_gap": "large", "catchup": "low"}, "Critical"),
    # value gap outranks count gap
    Rule({"value_gap": "moderate", "catchup": "low"}, "Suspect", 0.9),
    Rule({"value_gap": "moderate", "catchup": "high"}, "Watch", 0.8),
    Rule({"value_gap": "large", "catchup": "low"}, "Critical"),
    Rule({"value_gap": "large", "catchup": "high"}, "Suspect"),
    Rule({"value_gap": "small", "traffic": "peak", "catchup": "low"}, "Watch", 0.7),
    # duplicates: independent risk
    Rule({"dup_rate": "high"}, "Suspect", 0.9),
    Rule({"dup_rate": "high", "traffic": "peak"}, "Critical", 0.7),
    # amount integrity: matched records whose amounts disagree
    Rule({"mismatch": "high"}, "Suspect", 0.9),
]


def _decode_word(score: float, band: tuple[float, float]) -> tuple[str, float]:
    """CWW decoder: represent the type-reduced output as a small IT2 set
    around [band], pick codebook word with max Jaccard similarity."""
    lo, hi = band
    spread = max(hi - lo, 2.0)
    out = IT2Trap(
        "output",
        (max(0, lo - spread * 0.25), lo, hi, min(100, hi + spread * 0.25)),
        (lo, min(lo + spread * 0.25, hi), max(hi - spread * 0.25, lo), hi),
    )
    sims = {w: jaccard_it2(out, cb) for w, cb in CODEBOOK.items()}
    word = max(sims, key=sims.get)
    return word, sims[word]


def verdict_for_row(row: pd.Series) -> dict:
    inputs = {
        "count_gap": float(row["count_gap_pct"]),
        "value_gap": float(row["value_gap_pct"]),
        "dup_rate": float(row["dup_rate_pct"]),
        "catchup": float(row["catchup_rate_pct"]),
        "mismatch": float(row["mismatch_rate_pct"]),
        "traffic": float(row["traffic_pct"]),
    }
    tr = nie_tan(RULES, inputs, VOCAB, CODEBOOK)
    word, sim = _decode_word(tr["score"], tr["interval"])
    top = sorted(tr["firings"], key=lambda f: -max(f["f"]))[:3]
    return {
        "verdict": word,
        "score": round(tr["score"], 1),
        "band_lo": round(tr["interval"][0], 1),
        "band_hi": round(tr["interval"][1], 1),
        "similarity": round(sim, 3),
        "drivers": top,
    }


def run_verdicts(hourly: pd.DataFrame) -> pd.DataFrame:
    """hourly: output of recon.engine.reconcile_hourly. Adds traffic_pct
    (traffic as % of that record_type's daily peak) then applies the FLS."""
    df = hourly.copy()
    df["traffic_pct"] = df.groupby("record_type")["traffic_level"].transform(
        lambda s: s / s.max() * 100 if s.max() > 0 else 0
    )
    out = df.apply(verdict_for_row, axis=1, result_type="expand")
    return pd.concat([df, out], axis=1)
