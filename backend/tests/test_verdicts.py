"""Unit tests for the IT2 + CWW verdict framework.

These exercise only ``app.modules.assurance.verdicts`` (numpy-only) — no DB,
FastAPI, or ClickHouse — so they run fast and pin the fuzzy engine's behaviour.
The parity cases are the exact discrepancy vectors from the recon MVP's demo:
if a refactor changes any verdict/score here, it changed the classifier.
"""

import pytest

from app.modules.assurance.verdicts import PROFILES, get_profile, score

# (label, inputs, expected_verdict, expected_score) from the MVP run_demo output.
# inputs: count_gap, value_gap, dup_rate, catchup, mismatch, traffic
PARITY_CASES = [
    ("clean", dict(count_gap=0, value_gap=0, dup_rate=0, catchup=0, mismatch=0, traffic=30), "Healthy", 8.9),
    ("late_file_1", dict(count_gap=6.045, value_gap=0, dup_rate=0, catchup=100, mismatch=0, traffic=74.905), "Watch", 37.3),
    ("late_file_2", dict(count_gap=14.961, value_gap=0, dup_rate=0, catchup=100, mismatch=0, traffic=71.886), "Suspect", 65.3),
    ("leakage_big", dict(count_gap=11.946, value_gap=12.414, dup_rate=0, catchup=0, mismatch=0, traffic=97.924), "Critical", 82.5),
    ("leakage", dict(count_gap=2.505, value_gap=2.442, dup_rate=0, catchup=0, mismatch=0, traffic=97.924), "Suspect", 58.6),
    ("duplicates", dict(count_gap=0, value_gap=0, dup_rate=2.975, catchup=0, mismatch=0, traffic=80), "Suspect", 74.9),
]


@pytest.mark.parametrize("label, inputs, exp_verdict, exp_score", PARITY_CASES)
def test_recon_parity(label, inputs, exp_verdict, exp_score):
    profile = get_profile("recon")
    r = score(profile, inputs)
    assert r["verdict"] == exp_verdict, f"{label}: {r['verdict']} != {exp_verdict}"
    assert abs(r["score"] - exp_score) <= 0.15, f"{label}: score {r['score']} vs {exp_score}"


def test_score_shape():
    r = score(get_profile("recon"), {"count_gap": 12, "value_gap": 12, "catchup": 0, "traffic": 98})
    assert set(r) == {"verdict", "score", "band", "similarity", "drivers"}
    assert r["band"][0] <= r["score"] + 1 and r["band"][1] >= r["score"] - 1
    assert all({"rule", "consequent", "f"} <= set(d) for d in r["drivers"])


def test_missing_inputs_default_to_zero():
    # An all-clean vector with omitted inputs must still classify Healthy.
    assert score(get_profile("recon"), {}).get("verdict") == "Healthy"


def test_all_profiles_valid():
    # validate() runs at import, but assert it explicitly so a broken profile
    # fails a test rather than only crashing app startup.
    for profile in PROFILES.values():
        profile.validate()


def test_unknown_profile_raises():
    with pytest.raises(KeyError):
        get_profile("does-not-exist")
