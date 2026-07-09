"""Label + benchmark harness for verdict profiles.

Answers the only question that matters for the fuzzy layer: does it beat a crude
threshold alarm? For each profile we synthesize a LABELLED set of hours whose
ground-truth "is this a real incident?" comes from the *physical scenario*
(not from any classifier), then score every case two ways — the IT2+CWW engine
and a crisp catch-up-unaware threshold (the status-quo alarm) — and compare.

The discriminating case is latency: a gap that fully catches up / arrives late
is NOT leakage. A crisp threshold false-alarms on it; the fuzzy engine discounts
it via the catch-up term. This harness quantifies exactly that difference.

Labels are the analyst's intended judgement of the physical situation; both
models are evaluated against them, so neither is advantaged by construction.
"""

from __future__ import annotations

import random

from app.modules.assurance.verdicts import get_profile, score

# "Needs attention" = Suspect or worse. Healthy/Watch are treated as non-incident.
_INCIDENT_WORDS = {"Suspect", "Critical"}


# --- Labelled scenarios per profile ---------------------------------------
# Each: (name, is_incident, is_latency, sampler(rng) -> metrics dict).
# `is_latency` marks the catch-up/delayed cases — the ones a crisp alarm trips on.
def _recon_scenarios(rng: random.Random):
    return [
        ("clean", False, False, lambda: {
            "count_gap": rng.uniform(0, 0.4), "value_gap": rng.uniform(0, 0.3),
            "dup_rate": 0.0, "catchup": 0.0, "mismatch": 0.0, "traffic": rng.uniform(10, 100)}),
        # moderate gap that FULLY caught up next hour -> latency, not leakage
        ("late_file", False, True, lambda: {
            "count_gap": rng.uniform(3, 7), "value_gap": rng.uniform(0, 0.4),
            "dup_rate": 0.0, "catchup": rng.uniform(85, 100), "mismatch": 0.0, "traffic": rng.uniform(40, 100)}),
        ("small_leak", True, False, lambda: {
            "count_gap": rng.uniform(1.5, 3), "value_gap": rng.uniform(1.5, 3.5),
            "dup_rate": 0.0, "catchup": rng.uniform(0, 10), "mismatch": 0.0, "traffic": rng.uniform(40, 100)}),
        ("moderate_gap", True, False, lambda: {
            "count_gap": rng.uniform(4, 8), "value_gap": rng.uniform(0, 2),
            "dup_rate": 0.0, "catchup": rng.uniform(0, 15), "mismatch": 0.0, "traffic": rng.uniform(30, 100)}),
        ("big_leak", True, False, lambda: {
            "count_gap": rng.uniform(9, 16), "value_gap": rng.uniform(9, 16),
            "dup_rate": 0.0, "catchup": rng.uniform(0, 8), "mismatch": 0.0, "traffic": rng.uniform(50, 100)}),
        ("duplicates", True, False, lambda: {
            "count_gap": 0.0, "value_gap": 0.0, "dup_rate": rng.uniform(2, 5),
            "catchup": 0.0, "mismatch": 0.0, "traffic": rng.uniform(40, 100)}),
        ("amt_corrupt", True, False, lambda: {
            "count_gap": 0.0, "value_gap": rng.uniform(0.5, 1.5), "dup_rate": 0.0,
            "catchup": 0.0, "mismatch": rng.uniform(2, 5), "traffic": rng.uniform(40, 100)}),
    ]


def _recon_baseline(m: dict) -> str:
    """Crude threshold alarm, catch-up UNAWARE (the status quo)."""
    gap = max(m["count_gap"], m["value_gap"])
    if gap >= 8:
        return "Critical"
    if gap >= 1.5 or m["dup_rate"] >= 1.5 or m["mismatch"] >= 1.5:
        return "Suspect"
    return "Healthy"


def _fileseq_scenarios(rng: random.Random):
    return [
        ("clean", False, False, lambda: {
            "seq_gap": rng.uniform(0, 0.4), "delayed_share": 0.0,
            "out_of_order": 0.0, "gap_span": float(rng.randint(0, 2)), "traffic": rng.uniform(10, 100)}),
        # a batch that arrived LATE but arrived -> latency, not a true miss
        ("delayed_batch", False, True, lambda: {
            "seq_gap": rng.uniform(3, 7), "delayed_share": rng.uniform(85, 100),
            "out_of_order": 0.0, "gap_span": float(rng.randint(0, 3)), "traffic": rng.uniform(40, 100)}),
        ("small_gap", True, False, lambda: {
            "seq_gap": rng.uniform(2, 3.5), "delayed_share": rng.uniform(0, 12),
            "out_of_order": 0.0, "gap_span": float(rng.randint(1, 3)), "traffic": rng.uniform(40, 100)}),
        ("moderate_gap", True, False, lambda: {
            "seq_gap": rng.uniform(4, 8), "delayed_share": rng.uniform(0, 15),
            "out_of_order": 0.0, "gap_span": float(rng.randint(2, 6)), "traffic": rng.uniform(30, 100)}),
        ("big_gap", True, False, lambda: {
            "seq_gap": rng.uniform(12, 25), "delayed_share": rng.uniform(0, 8),
            "out_of_order": 0.0, "gap_span": float(rng.randint(10, 20)), "traffic": rng.uniform(50, 100)}),
    ]


def _fileseq_baseline(m: dict) -> str:
    if m["seq_gap"] >= 8 or m["gap_span"] >= 10:
        return "Critical"
    if m["seq_gap"] >= 1.5:
        return "Suspect"
    return "Healthy"


def _cross_scenarios(rng: random.Random):
    return [
        ("clean", False, False, lambda: {
            "missing_rate": rng.uniform(0, 0.4), "pending_share": 0.0,
            "unexpected_rate": 0.0, "field_drift": rng.uniform(0, 0.3), "traffic": rng.uniform(10, 100)}),
        # divergence still in-flight -> will reconcile, not a true miss
        ("pending_batch", False, True, lambda: {
            "missing_rate": rng.uniform(3, 7), "pending_share": rng.uniform(85, 100),
            "unexpected_rate": 0.0, "field_drift": rng.uniform(0, 0.3), "traffic": rng.uniform(40, 100)}),
        ("small_divergence", True, False, lambda: {
            "missing_rate": rng.uniform(1.5, 3), "pending_share": rng.uniform(0, 12),
            "unexpected_rate": 0.0, "field_drift": rng.uniform(0, 0.3), "traffic": rng.uniform(40, 100)}),
        ("moderate_missing", True, False, lambda: {
            "missing_rate": rng.uniform(4, 8), "pending_share": rng.uniform(0, 15),
            "unexpected_rate": 0.0, "field_drift": rng.uniform(0, 0.3), "traffic": rng.uniform(30, 100)}),
        ("large_missing", True, False, lambda: {
            "missing_rate": rng.uniform(12, 25), "pending_share": rng.uniform(0, 8),
            "unexpected_rate": 0.0, "field_drift": rng.uniform(0, 0.3), "traffic": rng.uniform(50, 100)}),
        ("field_drift", True, False, lambda: {
            "missing_rate": rng.uniform(0, 0.4), "pending_share": 0.0,
            "unexpected_rate": 0.0, "field_drift": rng.uniform(2, 6), "traffic": rng.uniform(40, 100)}),
        ("ghosts", True, False, lambda: {
            "missing_rate": 0.0, "pending_share": 0.0,
            "unexpected_rate": rng.uniform(2, 5), "field_drift": rng.uniform(0, 0.3), "traffic": rng.uniform(40, 100)}),
    ]


def _cross_baseline(m: dict) -> str:
    """Crisp threshold, latency (pending) UNAWARE."""
    if m["missing_rate"] >= 8 or m["field_drift"] >= 8:
        return "Critical"
    if m["missing_rate"] >= 1.5 or m["field_drift"] >= 1.5 or m["unexpected_rate"] >= 1.5:
        return "Suspect"
    return "Healthy"


def _filecoll_scenarios(rng: random.Random):
    return [
        ("clean", False, False, lambda: {
            "received_gap": rng.uniform(0, 0.4), "late_share": 0.0,
            "load_gap": 0.0, "breadth": 0.0, "traffic": rng.uniform(10, 100)}),
        # a batch that arrived LATE but arrived -> lateness, not loss
        ("late_batch", False, True, lambda: {
            "received_gap": rng.uniform(3, 7), "late_share": rng.uniform(85, 100),
            "load_gap": 0.0, "breadth": 0.0, "traffic": rng.uniform(40, 100)}),
        ("moderate_miss", True, False, lambda: {
            "received_gap": rng.uniform(4, 8), "late_share": rng.uniform(0, 15),
            "load_gap": 0.0, "breadth": 0.0, "traffic": rng.uniform(30, 100)}),
        ("big_miss", True, False, lambda: {
            "received_gap": rng.uniform(12, 25), "late_share": rng.uniform(0, 8),
            "load_gap": 0.0, "breadth": 0.0, "traffic": rng.uniform(50, 100)}),
        ("load_fail", True, False, lambda: {
            "received_gap": rng.uniform(0, 0.4), "late_share": 0.0,
            "load_gap": rng.uniform(2, 5), "breadth": 0.0, "traffic": rng.uniform(40, 100)}),
    ]


def _filecoll_baseline(m: dict) -> str:
    if m["received_gap"] >= 8:
        return "Critical"
    if m["received_gap"] >= 1.5 or m["load_gap"] >= 1.5:
        return "Suspect"
    return "Healthy"


def _procexc_scenarios(rng: random.Random):
    return [
        ("clean", False, False, lambda: {
            "exception_rate": rng.uniform(0, 0.4), "retry_cleared": 0.0,
            "reject_rate": 0.0, "traffic": rng.uniform(10, 100)}),
        # exceptions that CLEARED on retry -> transient, not loss
        ("transient", False, True, lambda: {
            "exception_rate": rng.uniform(3, 7), "retry_cleared": rng.uniform(85, 100),
            "reject_rate": 0.0, "traffic": rng.uniform(40, 100)}),
        ("moderate_exc", True, False, lambda: {
            "exception_rate": rng.uniform(4, 8), "retry_cleared": rng.uniform(0, 15),
            "reject_rate": 0.0, "traffic": rng.uniform(30, 100)}),
        ("large_exc", True, False, lambda: {
            "exception_rate": rng.uniform(10, 20), "retry_cleared": rng.uniform(0, 8),
            "reject_rate": 0.0, "traffic": rng.uniform(50, 100)}),
        ("rejects", True, False, lambda: {
            "exception_rate": rng.uniform(0, 0.4), "retry_cleared": 0.0,
            "reject_rate": rng.uniform(2, 5), "traffic": rng.uniform(40, 100)}),
    ]


def _procexc_baseline(m: dict) -> str:
    if m["exception_rate"] >= 8:
        return "Critical"
    if m["exception_rate"] >= 1.5 or m["reject_rate"] >= 1.5:
        return "Suspect"
    return "Healthy"


_HARNESS = {
    "recon": (_recon_scenarios, _recon_baseline),
    "file_sequence": (_fileseq_scenarios, _fileseq_baseline),
    "cross_recon": (_cross_scenarios, _cross_baseline),
    "file_collection": (_filecoll_scenarios, _filecoll_baseline),
    "processing_exception": (_procexc_scenarios, _procexc_baseline),
}


def has_harness(profile_key: str) -> bool:
    """Whether a labelled benchmark exists for this profile."""
    return profile_key in _HARNESS


def _metrics(tp: int, fp: int, fn: int, tn: int) -> dict:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    false_alarm = fp / (fp + tn) if (fp + tn) else 0.0
    return {
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "precision": round(precision, 3), "recall": round(recall, 3),
        "f1": round(f1, 3), "falseAlarmRate": round(false_alarm, 3),
    }


def evaluate(profile_key: str, *, n: int = 300, seed: int = 17) -> dict | None:
    """Score a labelled set with the fuzzy engine and the crisp baseline; return
    the head-to-head report. Returns None for profiles without a harness."""
    if profile_key not in _HARNESS:
        return None
    scen_fn, baseline_fn = _HARNESS[profile_key]
    prof = get_profile(profile_key)
    rng = random.Random(seed)
    scenarios = scen_fn(rng)

    # Confusion tallies for each model, plus latency-case false alarms.
    fz = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    bl = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    lat_total = lat_fz = lat_bl = 0

    for i in range(n):
        _name, is_incident, is_latency, sampler = scenarios[i % len(scenarios)]
        m = sampler()
        fuzzy_incident = score(prof, m)["verdict"] in _INCIDENT_WORDS
        base_incident = baseline_fn(m) in _INCIDENT_WORDS

        for tally, pred in ((fz, fuzzy_incident), (bl, base_incident)):
            if is_incident and pred:
                tally["tp"] += 1
            elif is_incident and not pred:
                tally["fn"] += 1
            elif not is_incident and pred:
                tally["fp"] += 1
            else:
                tally["tn"] += 1

        if is_latency:
            lat_total += 1
            lat_fz += int(fuzzy_incident)
            lat_bl += int(base_incident)

    return {
        "profile": profile_key,
        "sampleSize": n,
        "baselineName": "crisp threshold (catch-up unaware)",
        "fuzzy": _metrics(**fz),
        "baseline": _metrics(**bl),
        # Of the latency (caught-up / delayed) hours, how many each model wrongly
        # flagged as an incident. This is the headline: fuzzy should be ~0.
        "latencyFalseAlarms": {"total": lat_total, "fuzzy": lat_fz, "baseline": lat_bl},
    }


if __name__ == "__main__":
    for key in _HARNESS:
        r = evaluate(key)
        assert r is not None
        print(f"\n=== {key} (n={r['sampleSize']}) ===")
        print(f"  fuzzy    : F1={r['fuzzy']['f1']}  precision={r['fuzzy']['precision']}  "
              f"recall={r['fuzzy']['recall']}  false-alarm={r['fuzzy']['falseAlarmRate']}")
        print(f"  baseline : F1={r['baseline']['f1']}  precision={r['baseline']['precision']}  "
              f"recall={r['baseline']['recall']}  false-alarm={r['baseline']['falseAlarmRate']}")
        la = r["latencyFalseAlarms"]
        print(f"  latency false alarms: fuzzy {la['fuzzy']}/{la['total']}  vs baseline {la['baseline']}/{la['total']}")
