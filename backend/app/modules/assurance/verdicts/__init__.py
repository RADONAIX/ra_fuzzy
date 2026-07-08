"""IT2 + CWW verdict framework.

A report-agnostic engine (``engine.score``) runs a pluggable
:class:`VerdictProfile` (vocabulary + rule base + codebook) over a crisp feature
vector and classifies it Healthy / Watch / Suspect / Critical with an uncertainty
band and an IF/THEN rule trace.

This is the net-new IP grafted on top of the platform's reconciliation: the
platform reconciles per-record into ClickHouse; this layer adds context-aware,
catch-up-discounting triage. Recon is profile #1; new reports plug in by
declaring a profile in ``profiles`` — the engine is not touched.
"""

from app.modules.assurance.verdicts.engine import VerdictProfile, score
from app.modules.assurance.verdicts.profiles import PROFILES, get_profile

__all__ = ["VerdictProfile", "score", "PROFILES", "get_profile"]
