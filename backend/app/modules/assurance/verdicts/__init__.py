"""IT2 + CWW verdict layer.

Consumes the hourly discrepancy vector (derived from the rafms source unions in
``assurance.service``) and classifies each ``(record_type, hour)`` bucket with an
Interval Type-2 fuzzy system + Computing-With-Words decoder, emitting a plain
verdict: Healthy / Watch / Suspect / Critical.

This is the net-new IP grafted on top of the platform's existing reconciliation:
the platform reconciles per-record into ClickHouse; this layer adds context-aware,
catch-up-discounting triage with an uncertainty band and an IF/THEN rule trace.
"""

from app.modules.assurance.verdicts.fls import score_row

__all__ = ["score_row"]
