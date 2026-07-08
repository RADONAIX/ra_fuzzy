"""Per-report verdict profiles.

Adding a report/use-case = adding a :class:`VerdictProfile` here (its vocabulary
+ rule base); the engine, codebook, and CWW decoder are shared. Recon is
profile #1. Planned next profiles (see roadmap): file-collection, file-sequence
(reuses the catch-up idea), cross-recon, and the overview roll-up.

Each profile is the *fuzzy spec* only. The crisp feature vector it scores is
produced by a report-specific extractor in the owning service (for recon, the
ClickHouse aggregations in ``assurance.service``).
"""

from __future__ import annotations

from app.modules.assurance.verdicts.engine import VerdictProfile
from app.modules.assurance.verdicts.it2 import IT2Trap, Rule

# ===========================================================================
# Profile: recon — AIR pre->post reconciliation
# ===========================================================================
# Input vocabulary. Upper trapezoid = generous reading, lower = strict reading;
# the gap between them (FOU) encodes "the boundary itself is uncertain". Gap
# scales are % of records/value; traffic is % of daily peak.
_RECON_VOCAB: dict[str, dict[str, IT2Trap]] = {
    "count_gap": {
        "negligible": IT2Trap("negligible", (0, 0, 0.3, 1.0), (0, 0, 0.2, 0.6)),
        "small": IT2Trap("small", (0.2, 0.8, 2.0, 4.0), (0.5, 1.0, 1.6, 3.0)),
        "moderate": IT2Trap("moderate", (2.0, 4.0, 8.0, 15.0), (3.0, 5.0, 7.0, 12.0)),
        "large": IT2Trap("large", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
    },
    "value_gap": {
        "negligible": IT2Trap("negligible", (0, 0, 0.3, 1.0), (0, 0, 0.2, 0.6)),
        "small": IT2Trap("small", (0.2, 0.8, 2.0, 4.0), (0.5, 1.0, 1.6, 3.0)),
        "moderate": IT2Trap("moderate", (2.0, 4.0, 8.0, 15.0), (3.0, 5.0, 7.0, 12.0)),
        "large": IT2Trap("large", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
    },
    "dup_rate": {
        "low": IT2Trap("low", (0, 0, 0.2, 1.0), (0, 0, 0.1, 0.5)),
        "high": IT2Trap("high", (0.2, 1.5, 100, 100), (0.8, 3.0, 100, 100)),
    },
    "catchup": {
        "low": IT2Trap("low", (0, 0, 30, 60), (0, 0, 20, 45)),
        "high": IT2Trap("high", (40, 70, 100, 100), (55, 85, 100, 100)),
    },
    "mismatch": {
        "low": IT2Trap("low", (0, 0, 0.2, 1.0), (0, 0, 0.1, 0.5)),
        "high": IT2Trap("high", (0.3, 2.0, 100, 100), (1.0, 4.0, 100, 100)),
    },
    "traffic": {
        "quiet": IT2Trap("quiet", (0, 0, 15, 35), (0, 0, 10, 25)),
        "normal": IT2Trap("normal", (15, 35, 60, 80), (25, 42, 55, 70)),
        "peak": IT2Trap("peak", (60, 80, 100, 100), (70, 90, 100, 100)),
    },
}

# Rule base (hand-crafted for MVP). RA-analyst intuition encoded:
#   - a gap that catches up next hour is latency, not leakage
#   - the same gap at peak traffic risks more revenue -> escalate
#   - value gap outranks count gap (revenue is what leaks)
#   - duplicates are an overbilling/regulatory risk on their own
_RECON_RULES: list[Rule] = [
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

RECON = VerdictProfile(
    key="recon",
    label="AIR pre→post reconciliation",
    inputs=("count_gap", "value_gap", "dup_rate", "catchup", "mismatch", "traffic"),
    vocab=_RECON_VOCAB,
    rules=_RECON_RULES,
)

# ===========================================================================
# Registry
# ===========================================================================
PROFILES: dict[str, VerdictProfile] = {p.key: p for p in (RECON,)}

# Fail at import time if any profile has a rule/vocab/codebook mismatch.
for _profile in PROFILES.values():
    _profile.validate()


def get_profile(key: str) -> VerdictProfile:
    try:
        return PROFILES[key]
    except KeyError as exc:
        raise KeyError(
            f"Unknown verdict profile {key!r}. Available: {sorted(PROFILES)}"
        ) from exc
