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

# ---------------------------------------------------------------------------
# Reusable linguistic term sets — the same trapezoids recur across reports that
# share a scale (a % gap, a low/high share, a low/high rare-event rate, etc.).
# Sharing the dicts keeps profiles concise and their scales consistent.
# ---------------------------------------------------------------------------
_PCT_GAP = {  # a percentage gap/rate: negligible → large
    "negligible": IT2Trap("negligible", (0, 0, 0.3, 1.0), (0, 0, 0.2, 0.6)),
    "small": IT2Trap("small", (0.2, 0.8, 2.0, 4.0), (0.5, 1.0, 1.6, 3.0)),
    "moderate": IT2Trap("moderate", (2.0, 4.0, 8.0, 15.0), (3.0, 5.0, 7.0, 12.0)),
    "large": IT2Trap("large", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
}
_SHARE = {  # low/high share of something (catch-up / pending / late / retry-cleared)
    "low": IT2Trap("low", (0, 0, 30, 60), (0, 0, 20, 45)),
    "high": IT2Trap("high", (40, 70, 100, 100), (55, 85, 100, 100)),
}
_RARE = {  # low/high rate for an independent rare risk (dup / mismatch / reject / load)
    "low": IT2Trap("low", (0, 0, 0.2, 1.0), (0, 0, 0.1, 0.5)),
    "high": IT2Trap("high", (0.3, 2.0, 100, 100), (1.0, 4.0, 100, 100)),
}
_BREADTH = {  # narrow/wide breadth of affected streams
    "narrow": IT2Trap("narrow", (0, 0, 30, 55), (0, 0, 22, 45)),
    "wide": IT2Trap("wide", (45, 70, 100, 100), (58, 82, 100, 100)),
}
_RUN = {  # length of a consecutive-missing run (counts, not %)
    "small": IT2Trap("small", (0, 0, 3, 8), (0, 0, 2, 6)),
    "large": IT2Trap("large", (5, 12, 10000, 10000), (9, 20, 10000, 10000)),
}
_TRAFFIC = {  # quiet/normal/peak (% of daily peak)
    "quiet": IT2Trap("quiet", (0, 0, 15, 35), (0, 0, 10, 25)),
    "normal": IT2Trap("normal", (15, 35, 60, 80), (25, 42, 55, 70)),
    "peak": IT2Trap("peak", (60, 80, 100, 100), (70, 90, 100, 100)),
}

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
    entity_label="Record type",
    metric_labels={
        "count_gap": "Count gap %",
        "value_gap": "Value gap %",
        "catchup": "Catch-up %",
        "dup_rate": "Dup rate %",
        "mismatch": "Mismatch %",
        "traffic": "Traffic %",
    },
)


# ===========================================================================
# Profile: file_sequence — Missing File Sequence (FR-038–043)
# ===========================================================================
# Per (source, hour) "sequence severity". Reuses the recon catch-up idea:
# a sequence number that arrives LATE (delayed) is latency, not a true miss —
# so a high delayed_share pulls the verdict down, exactly like catch-up.
_FILESEQ_VOCAB: dict[str, dict[str, IT2Trap]] = {
    # % of expected sequence numbers absent this hour (missing + delayed)
    "seq_gap": {
        "negligible": IT2Trap("negligible", (0, 0, 0.3, 1.0), (0, 0, 0.2, 0.6)),
        "small": IT2Trap("small", (0.2, 0.8, 2.0, 4.0), (0.5, 1.0, 1.6, 3.0)),
        "moderate": IT2Trap("moderate", (2.0, 4.0, 8.0, 15.0), (3.0, 5.0, 7.0, 12.0)),
        "large": IT2Trap("large", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
    },
    # % of that gap explained by late-but-arrived files (the catch-up analog)
    "delayed_share": {
        "low": IT2Trap("low", (0, 0, 30, 60), (0, 0, 20, 45)),
        "high": IT2Trap("high", (40, 70, 100, 100), (55, 85, 100, 100)),
    },
    # % of files arriving out of sequence order (independent integrity risk)
    "out_of_order": {
        "low": IT2Trap("low", (0, 0, 0.2, 1.0), (0, 0, 0.1, 0.5)),
        "high": IT2Trap("high", (0.3, 2.0, 100, 100), (1.0, 4.0, 100, 100)),
    },
    # largest CONSECUTIVE missing run (count of files) — a big contiguous hole is
    # worse than the same count scattered
    "gap_span": {
        "small": IT2Trap("small", (0, 0, 3, 8), (0, 0, 2, 6)),
        "large": IT2Trap("large", (5, 12, 10000, 10000), (9, 20, 10000, 10000)),
    },
    "traffic": {
        "quiet": IT2Trap("quiet", (0, 0, 15, 35), (0, 0, 10, 25)),
        "normal": IT2Trap("normal", (15, 35, 60, 80), (25, 42, 55, 70)),
        "peak": IT2Trap("peak", (60, 80, 100, 100), (70, 90, 100, 100)),
    },
}

_FILESEQ_RULES: list[Rule] = [
    # clean
    Rule({"seq_gap": "negligible", "out_of_order": "low"}, "Healthy"),
    # small gap: delayed-share decides (late files caught up = latency)
    Rule({"seq_gap": "small", "delayed_share": "high"}, "Healthy", 0.9),
    Rule({"seq_gap": "small", "delayed_share": "low", "traffic": "normal"}, "Watch"),
    Rule({"seq_gap": "small", "delayed_share": "low", "traffic": "peak"}, "Suspect"),
    # moderate gap
    Rule({"seq_gap": "moderate", "delayed_share": "high"}, "Watch"),
    Rule({"seq_gap": "moderate", "delayed_share": "low"}, "Suspect"),
    Rule({"seq_gap": "moderate", "delayed_share": "low", "traffic": "peak"}, "Critical", 0.8),
    # large gap
    Rule({"seq_gap": "large", "delayed_share": "high"}, "Suspect"),
    Rule({"seq_gap": "large", "delayed_share": "low"}, "Critical"),
    # a big contiguous hole escalates on its own (a whole batch window is gone)
    Rule({"gap_span": "large"}, "Suspect", 0.9),
    Rule({"gap_span": "large", "traffic": "peak"}, "Critical", 0.7),
    # ordering problems: a milder, independent risk
    Rule({"out_of_order": "high"}, "Watch", 0.7),
    Rule({"out_of_order": "high", "seq_gap": "moderate"}, "Suspect", 0.7),
]

FILE_SEQUENCE = VerdictProfile(
    key="file_sequence",
    label="Missing File Sequence",
    inputs=("seq_gap", "delayed_share", "out_of_order", "gap_span", "traffic"),
    vocab=_FILESEQ_VOCAB,
    rules=_FILESEQ_RULES,
    entity_label="Source",
    metric_labels={
        "seq_gap": "Seq gap %",
        "delayed_share": "Delayed %",
        "out_of_order": "Out-of-order %",
        "gap_span": "Max gap",
        "traffic": "Traffic %",
    },
)


# ===========================================================================
# Profile: cross_recon — AIR↔SDP cross-reconciliation (FR-059)
# ===========================================================================
# Per event-type "agreement confidence". Cross-source events don't map 1:1 and
# fields carry tolerances, so this is inherently the fuzziest report. It reuses
# the latency idea a third time: a divergence still in-flight (pending) will
# reconcile — it is not (yet) a true miss.
_CROSS_VOCAB: dict[str, dict[str, IT2Trap]] = {
    # % of events on one side with no counterpart on the other (true divergence)
    "missing_rate": {
        "negligible": IT2Trap("negligible", (0, 0, 0.3, 1.0), (0, 0, 0.2, 0.6)),
        "small": IT2Trap("small", (0.2, 0.8, 2.0, 4.0), (0.5, 1.0, 1.6, 3.0)),
        "moderate": IT2Trap("moderate", (2.0, 4.0, 8.0, 15.0), (3.0, 5.0, 7.0, 12.0)),
        "large": IT2Trap("large", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
    },
    # % of that divergence still in-flight (will reconcile) — the catch-up analog
    "pending_share": {
        "low": IT2Trap("low", (0, 0, 30, 60), (0, 0, 20, 45)),
        "high": IT2Trap("high", (40, 70, 100, 100), (55, 85, 100, 100)),
    },
    # % of ghost records: present on one side, never expected on the other
    "unexpected_rate": {
        "low": IT2Trap("low", (0, 0, 0.2, 1.0), (0, 0, 0.1, 0.5)),
        "high": IT2Trap("high", (0.3, 2.0, 100, 100), (1.0, 4.0, 100, 100)),
    },
    # % of matched pairs whose fields disagree beyond tolerance (amount/attr drift)
    "field_drift": {
        "low": IT2Trap("low", (0, 0, 0.5, 2.0), (0, 0, 0.3, 1.2)),
        "moderate": IT2Trap("moderate", (1.0, 3.0, 8.0, 15.0), (2.0, 4.0, 7.0, 12.0)),
        "high": IT2Trap("high", (8.0, 15.0, 100, 100), (12.0, 20.0, 100, 100)),
    },
    "traffic": {
        "quiet": IT2Trap("quiet", (0, 0, 15, 35), (0, 0, 10, 25)),
        "normal": IT2Trap("normal", (15, 35, 60, 80), (25, 42, 55, 70)),
        "peak": IT2Trap("peak", (60, 80, 100, 100), (70, 90, 100, 100)),
    },
}

_CROSS_RULES: list[Rule] = [
    Rule({"missing_rate": "negligible", "unexpected_rate": "low", "field_drift": "low"}, "Healthy"),
    # small divergence: pending-share decides (in-flight = will reconcile)
    Rule({"missing_rate": "small", "pending_share": "high"}, "Healthy", 0.9),
    Rule({"missing_rate": "small", "pending_share": "low", "traffic": "normal"}, "Watch"),
    Rule({"missing_rate": "small", "pending_share": "low", "traffic": "peak"}, "Suspect"),
    # moderate / large divergence
    Rule({"missing_rate": "moderate", "pending_share": "high"}, "Watch"),
    Rule({"missing_rate": "moderate", "pending_share": "low"}, "Suspect"),
    Rule({"missing_rate": "moderate", "pending_share": "low", "traffic": "peak"}, "Critical", 0.8),
    Rule({"missing_rate": "large", "pending_share": "high"}, "Suspect"),
    Rule({"missing_rate": "large", "pending_share": "low"}, "Critical"),
    # field drift — values disagree across systems (direct revenue integrity risk)
    Rule({"field_drift": "moderate"}, "Suspect", 0.9),
    Rule({"field_drift": "high"}, "Critical", 0.8),
    # ghosts / unexpected records on one side
    Rule({"unexpected_rate": "high"}, "Suspect", 0.9),
    Rule({"unexpected_rate": "high", "traffic": "peak"}, "Critical", 0.7),
]

CROSS_RECON = VerdictProfile(
    key="cross_recon",
    label="AIR↔SDP cross-reconciliation",
    inputs=("missing_rate", "pending_share", "unexpected_rate", "field_drift", "traffic"),
    vocab=_CROSS_VOCAB,
    rules=_CROSS_RULES,
    entity_label="Event type",
    metric_labels={
        "missing_rate": "Missing %",
        "pending_share": "Pending %",
        "unexpected_rate": "Unexpected %",
        "field_drift": "Field drift %",
        "traffic": "Traffic %",
    },
)


# ===========================================================================
# Profile: file_collection — File Collection & Load (FR-032–037)
# ===========================================================================
# Per source collection health. Reuses the latency idea: files that arrived LATE
# but arrived (late_share) are lateness, not loss. load_gap (received-but-not-
# loaded) is an independent downstream risk.
FILE_COLLECTION = VerdictProfile(
    key="file_collection",
    label="File Collection & Load",
    inputs=("received_gap", "late_share", "load_gap", "breadth", "traffic"),
    vocab={
        "received_gap": _PCT_GAP,
        "late_share": _SHARE,
        "load_gap": _RARE,
        "breadth": _BREADTH,
        "traffic": _TRAFFIC,
    },
    rules=[
        Rule({"received_gap": "negligible", "load_gap": "low"}, "Healthy"),
        Rule({"received_gap": "small", "late_share": "high"}, "Healthy", 0.9),
        Rule({"received_gap": "small", "late_share": "low", "traffic": "normal"}, "Watch"),
        Rule({"received_gap": "small", "late_share": "low", "traffic": "peak"}, "Suspect"),
        Rule({"received_gap": "moderate", "late_share": "high"}, "Watch"),
        Rule({"received_gap": "moderate", "late_share": "low"}, "Suspect"),
        Rule({"received_gap": "moderate", "late_share": "low", "traffic": "peak"}, "Critical", 0.8),
        Rule({"received_gap": "large", "late_share": "high"}, "Suspect"),
        Rule({"received_gap": "large", "late_share": "low"}, "Critical"),
        # received but not loaded → downstream load failure, independent risk
        Rule({"load_gap": "high"}, "Suspect", 0.9),
        Rule({"load_gap": "high", "traffic": "peak"}, "Critical", 0.7),
        Rule({"breadth": "wide", "received_gap": "moderate"}, "Suspect", 0.7),
    ],
    entity_label="Source",
    metric_labels={
        "received_gap": "Received gap %",
        "late_share": "Late %",
        "load_gap": "Load gap %",
        "breadth": "Breadth %",
        "traffic": "Traffic %",
    },
)


# ===========================================================================
# Profile: record_sequence — Missing Record Sequence (FR-044–049)
# ===========================================================================
# Per node gap severity. NOTE: a "Moderate" fuzzy fit — a missing record sequence
# number has no latency/catch-up (it doesn't arrive later), so there is no binary
# false-alarm advantage over a threshold. The fuzzy value here is SEVERITY
# grading (a clustered gap is worse than the same count scattered) — which the
# binary incident benchmark does not measure, so this profile has no benchmark
# (see roadmap: needs an ordinal/severity benchmark).
RECORD_SEQUENCE = VerdictProfile(
    key="record_sequence",
    label="Missing Record Sequence",
    inputs=("gap_rate", "max_run", "cluster_ratio", "traffic"),
    vocab={
        "gap_rate": _PCT_GAP,
        "max_run": _RUN,
        "cluster_ratio": _SHARE,
        "traffic": _TRAFFIC,
    },
    rules=[
        Rule({"gap_rate": "negligible"}, "Healthy"),
        Rule({"gap_rate": "small"}, "Watch", 0.8),
        Rule({"gap_rate": "small", "traffic": "peak"}, "Suspect"),
        Rule({"gap_rate": "moderate"}, "Suspect"),
        Rule({"gap_rate": "moderate", "traffic": "peak"}, "Critical", 0.8),
        Rule({"gap_rate": "large"}, "Critical"),
        # a long contiguous run is worse than scattered gaps of the same count
        Rule({"max_run": "large"}, "Suspect", 0.9),
        Rule({"max_run": "large", "traffic": "peak"}, "Critical", 0.7),
        Rule({"cluster_ratio": "high", "gap_rate": "moderate"}, "Suspect", 0.7),
    ],
    entity_label="Node",
    metric_labels={
        "gap_rate": "Gap %",
        "max_run": "Max run",
        "cluster_ratio": "Clustered %",
        "traffic": "Traffic %",
    },
)


# ===========================================================================
# Profile: processing_exception — File Processing & Exception (FR-050–055)
# ===========================================================================
# Per source processing health. Reuses the latency idea a fourth time: exceptions
# that CLEARED on retry (retry_cleared) are transient, not permanent loss — they
# discount the verdict, exactly like catch-up. Hard rejects are the real risk.
PROCESSING_EXCEPTION = VerdictProfile(
    key="processing_exception",
    label="File Processing & Exception",
    inputs=("exception_rate", "retry_cleared", "reject_rate", "traffic"),
    vocab={
        "exception_rate": _PCT_GAP,
        "retry_cleared": _SHARE,
        "reject_rate": _RARE,
        "traffic": _TRAFFIC,
    },
    rules=[
        Rule({"exception_rate": "negligible", "reject_rate": "low"}, "Healthy"),
        Rule({"exception_rate": "small", "retry_cleared": "high"}, "Healthy", 0.9),
        Rule({"exception_rate": "small", "retry_cleared": "low"}, "Watch"),
        Rule({"exception_rate": "moderate", "retry_cleared": "high"}, "Watch"),
        Rule({"exception_rate": "moderate", "retry_cleared": "low"}, "Suspect"),
        Rule({"exception_rate": "moderate", "retry_cleared": "low", "traffic": "peak"}, "Critical", 0.8),
        Rule({"exception_rate": "large", "retry_cleared": "high"}, "Suspect"),
        Rule({"exception_rate": "large", "retry_cleared": "low"}, "Critical"),
        # hard rejections (not retryable) — permanent processing loss
        Rule({"reject_rate": "high"}, "Suspect", 0.9),
        Rule({"reject_rate": "high", "traffic": "peak"}, "Critical", 0.7),
    ],
    entity_label="Source",
    metric_labels={
        "exception_rate": "Exception %",
        "retry_cleared": "Retry-cleared %",
        "reject_rate": "Reject %",
        "traffic": "Traffic %",
    },
)


# ===========================================================================
# Profile: overview — platform health roll-up (FR-060)
# ===========================================================================
# A META profile: its inputs are NOT read from a data source but AGGREGATED from
# the other profiles' verdicts (see assurance.service._overview_vectors). It
# produces one verdict per scope (each source + PLATFORM), per hour.
_OVERVIEW_VOCAB: dict[str, dict[str, IT2Trap]] = {
    # worst child verdict score in the scope/hour (0–100)
    "worst_score": {
        "low": IT2Trap("low", (0, 0, 30, 50), (0, 0, 25, 42)),
        "medium": IT2Trap("medium", (30, 45, 62, 75), (38, 50, 58, 70)),
        "high": IT2Trap("high", (60, 75, 100, 100), (70, 85, 100, 100)),
    },
    # % of child buckets that are Critical
    "critical_share": {
        "low": IT2Trap("low", (0, 0, 2, 6), (0, 0, 1, 4)),
        "high": IT2Trap("high", (3, 10, 100, 100), (6, 15, 100, 100)),
    },
    # % of child buckets that are Suspect or worse
    "suspect_share": {
        "low": IT2Trap("low", (0, 0, 4, 10), (0, 0, 3, 7)),
        "moderate": IT2Trap("moderate", (6, 14, 28, 45), (10, 18, 25, 38)),
        "high": IT2Trap("high", (28, 50, 100, 100), (38, 60, 100, 100)),
    },
    # % of report types in the scope showing Suspect+ (how broad the trouble is)
    "breadth": {
        "narrow": IT2Trap("narrow", (0, 0, 30, 55), (0, 0, 22, 45)),
        "wide": IT2Trap("wide", (45, 70, 100, 100), (58, 82, 100, 100)),
    },
}

_OVERVIEW_RULES: list[Rule] = [
    Rule({"worst_score": "low", "suspect_share": "low"}, "Healthy"),
    Rule({"worst_score": "medium", "critical_share": "low"}, "Watch"),
    Rule({"worst_score": "medium", "suspect_share": "moderate"}, "Suspect"),
    Rule({"worst_score": "high", "critical_share": "low"}, "Suspect"),
    Rule({"worst_score": "high", "critical_share": "high"}, "Critical"),
    Rule({"critical_share": "high"}, "Critical", 0.9),
    # widespread trouble escalates even without a single Critical child
    Rule({"suspect_share": "high", "breadth": "wide"}, "Critical", 0.8),
    Rule({"suspect_share": "moderate", "breadth": "wide"}, "Suspect", 0.9),
    Rule({"suspect_share": "moderate"}, "Watch", 0.7),
    Rule({"breadth": "wide", "worst_score": "medium"}, "Suspect", 0.7),
]

OVERVIEW = VerdictProfile(
    key="overview",
    label="Platform health roll-up",
    inputs=("worst_score", "critical_share", "suspect_share", "breadth"),
    vocab=_OVERVIEW_VOCAB,
    rules=_OVERVIEW_RULES,
    entity_label="Scope",
    metric_labels={
        "worst_score": "Worst score",
        "critical_share": "Critical %",
        "suspect_share": "Suspect+ %",
        "breadth": "Breadth %",
    },
)


# ===========================================================================
# Registry
# ===========================================================================
PROFILES: dict[str, VerdictProfile] = {
    p.key: p
    for p in (
        RECON,
        FILE_SEQUENCE,
        CROSS_RECON,
        FILE_COLLECTION,
        RECORD_SEQUENCE,
        PROCESSING_EXCEPTION,
        OVERVIEW,
    )
}

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
