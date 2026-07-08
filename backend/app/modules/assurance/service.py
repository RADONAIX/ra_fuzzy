"""Assurance business logic: reconciliation reads, cases, workbench."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.data_sources import enabled_streams
from app.core.errors import NotFoundError, UpstreamUnavailableError
from app.core.logging import get_logger
from app.integrations import clickhouse
from app.modules.assurance import schemas
from app.modules.assurance.models import Case, CaseComment, SavedQuery
from app.modules.assurance.verdicts import get_profile, score

log = get_logger("assurance")

_RECON_PROFILE = get_profile("recon")

_AMOUNT_TOL = 0.005  # currency tolerance for amount comparison (matches recon MVP)


def _ident() -> str:
    return "`" + settings.clickhouse_database.replace("`", "``") + "`"


# --- Reconciliation --------------------------------------------------------
async def recon_summary(*, hours: int = 24) -> schemas.ReconSummary:
    try:
        ident = _ident()
        rows = await clickhouse.query(
            f"""
            SELECT
                count() AS total,
                countIf(reconciliation_status = 'MATCHED') AS matched,
                countIf(reconciliation_status = 'AMOUNT_MISMATCH') AS amount_mismatch,
                countIf(reconciliation_status = 'RAW_ONLY') AS raw_only,
                countIf(reconciliation_status = 'PROC_ONLY') AS proc_only,
                sumIf(ifNull(raw_tran_amt, 0), reconciliation_status = 'RAW_ONLY')
                  + sumIf(abs(ifNull(raw_tran_amt, 0) - ifNull(proc_tran_amt, 0)),
                          reconciliation_status = 'AMOUNT_MISMATCH') AS leakage
            FROM {ident}.air_reconciliation FINAL
            WHERE created_time >= now() - INTERVAL {int(hours)} HOUR
            """
        )
        r = rows[0] if rows else {}
        total = int(r.get("total") or 0)
        matched = int(r.get("matched") or 0)
        return schemas.ReconSummary(
            total=total,
            matched=matched,
            amountMismatch=int(r.get("amount_mismatch") or 0),
            rawOnly=int(r.get("raw_only") or 0),
            procOnly=int(r.get("proc_only") or 0),
            matchRate=round(matched / total * 100, 2) if total else 100.0,
            estimatedLeakage=round(float(r.get("leakage") or 0), 2),
        )
    except UpstreamUnavailableError:
        log.info("recon_summary_fallback", reason="clickhouse_unavailable")
        return schemas.ReconSummary(
            total=0,
            matched=0,
            amountMismatch=0,
            rawOnly=0,
            procOnly=0,
            matchRate=100.0,
            estimatedLeakage=0.0,
        )


async def recon_records(
    *, status: str | None, limit: int, offset: int
) -> list[schemas.ReconRecord]:
    ident = _ident()
    where = "1=1"
    params: dict = {}
    if status:
        where = "reconciliation_status = {status:String}"
        params["status"] = status.upper()
    rows = await clickhouse.query(
        f"""
        SELECT record_type, raw_txn_id, proc_txn_id, raw_node_id, proc_node_id,
               raw_subscriber_num, proc_subscriber_num, raw_tran_amt, proc_tran_amt,
               raw_acc_balance, proc_acc_balance, reconciliation_status, created_time
        FROM {ident}.air_reconciliation FINAL
        WHERE {where}
        ORDER BY created_time DESC
        LIMIT {int(limit)} OFFSET {int(offset)}
        """,
        params,
    )
    out = []
    for r in rows:
        out.append(
            schemas.ReconRecord(
                recordType=r.get("record_type"),
                txnId=r.get("raw_txn_id") or r.get("proc_txn_id"),
                nodeId=r.get("raw_node_id") or r.get("proc_node_id"),
                subscriberNum=r.get("raw_subscriber_num") or r.get("proc_subscriber_num"),
                rawAmount=r.get("raw_tran_amt"),
                procAmount=r.get("proc_tran_amt"),
                rawBalance=r.get("raw_acc_balance"),
                procBalance=r.get("proc_acc_balance"),
                status=r.get("reconciliation_status"),
                createdTime=r.get("created_time"),
            )
        )
    return out


# --- IT2 + CWW hourly verdicts ---------------------------------------------
def _stream(stream_key: str):
    for s in enabled_streams():
        if s.key == stream_key.lower():
            return s
    raise NotFoundError(f"Unknown or disabled data stream: {stream_key!r}.")


def _raw_driven_sql(ident: str, raw_tbl: str, proc_tbl: str, hours: int) -> str:
    """Raw-centric hourly metrics: matched / catch-up / raw_only / amount mismatch /
    value gap. Catch-up is defined on mediation LATENCY — a raw record whose
    processed counterpart was *created* in a later hour bucket than the raw origin
    hour. (origin timestamps describe the same event and don't diverge by hour;
    proc_create_timestamp is when mediation actually produced the record.)"""
    return f"""
    WITH
      (SELECT max(raw_origin_timestamp) FROM {ident}.{raw_tbl}) AS anchor,
      raw AS (
        SELECT
          record_type AS rt,
          concat(toString(raw_txn_id), '|', toString(raw_seq_no)) AS k,
          toStartOfHour(raw_origin_timestamp) AS hour,
          abs(toFloat64OrZero(toString(raw_tran_amt))) AS amt
        FROM {ident}.{raw_tbl}
        WHERE raw_origin_timestamp >= anchor - INTERVAL {int(hours)} HOUR
      ),
      proc AS (
        SELECT
          concat(toString(proc_txn_id), '|', toString(proc_seq_no)) AS k,
          toStartOfHour(proc_create_timestamp) AS proc_hour,
          abs(toFloat64OrZero(toString(proc_tran_amt))) AS amt,
          proc_create_timestamp AS lat_ts
        FROM {ident}.{proc_tbl}
      ),
      proc_first AS (
        SELECT
          k,
          argMin(proc_hour, lat_ts) AS proc_hour,
          argMin(amt, lat_ts) AS amt,
          toUInt8(1) AS present
        FROM proc GROUP BY k
      )
    SELECT
      r.rt AS record_type,
      r.hour AS hour,
      count() AS raw_count,
      sum(pf.present) AS matched,
      countIf(pf.present = 1 AND pf.proc_hour > r.hour) AS catchup,
      countIf(pf.present = 0) AS raw_only,
      countIf(pf.present = 1 AND abs(r.amt - pf.amt) > {_AMOUNT_TOL}) AS amt_mismatch,
      sum(r.amt) AS raw_val,
      sumIf(pf.amt, pf.present = 1) AS matched_val
    FROM raw AS r
    LEFT JOIN proc_first AS pf ON r.k = pf.k
    GROUP BY r.rt, r.hour
    ORDER BY r.rt, r.hour
    """


def _proc_driven_sql(ident: str, raw_tbl: str, proc_tbl: str, hours: int) -> str:
    """Processed-centric metrics the raw-driven join can't see: proc_count,
    duplicate rows, and PROC_ONLY (ghosts with no raw counterpart). First-slice
    approximation: a key's rows are attributed to its earliest processed hour."""
    return f"""
    WITH
      (SELECT max(proc_create_timestamp) FROM {ident}.{proc_tbl}) AS anchor,
      raw_keys AS (
        SELECT DISTINCT concat(toString(raw_txn_id), '|', toString(raw_seq_no)) AS k
        FROM {ident}.{raw_tbl}
      ),
      proc AS (
        SELECT
          record_type AS rt,
          concat(toString(proc_txn_id), '|', toString(proc_seq_no)) AS k,
          toStartOfHour(proc_create_timestamp) AS proc_hour
        FROM {ident}.{proc_tbl}
        WHERE proc_create_timestamp >= anchor - INTERVAL {int(hours)} HOUR
      ),
      by_key AS (
        SELECT k, any(rt) AS rt, min(proc_hour) AS hour, count() AS cnt
        FROM proc GROUP BY k
      )
    SELECT
      rt AS record_type,
      hour AS hour,
      sum(cnt) AS proc_count,
      sum(cnt - 1) AS dup_count,
      countIf(k NOT IN (SELECT k FROM raw_keys)) AS proc_only
    FROM by_key
    GROUP BY rt, hour
    ORDER BY rt, hour
    """


def _fmt_driver(d: dict) -> schemas.VerdictDriver:
    rule = " & ".join(f"{k}={v}" for k, v in d["rule"].items())
    f_lo, f_hi = d["f"]
    return schemas.VerdictDriver(rule=rule, consequent=d["consequent"], firingLo=f_lo, firingHi=f_hi)


async def recon_verdicts(*, stream: str = "air", hours: int = 48) -> list[schemas.VerdictRow]:
    """Derive the hourly discrepancy vector from the stream's source unions and
    classify each (record_type, hour) with the IT2 + CWW verdict engine.

    Compute-on-read: two ClickHouse aggregations + in-process scoring. If
    ClickHouse is unavailable this degrades to an empty list (like recon_summary)
    rather than erroring the dashboard.
    """
    try:
        s = _stream(stream)
        ident = _ident()
        raw_tbl, proc_tbl = s.t("raw_union"), s.t("processed_union")
        raw_rows = await clickhouse.query(_raw_driven_sql(ident, raw_tbl, proc_tbl, hours))
        proc_rows = await clickhouse.query(_proc_driven_sql(ident, raw_tbl, proc_tbl, hours))
    except UpstreamUnavailableError:
        log.info("recon_verdicts_fallback", reason="clickhouse_unavailable", stream=stream)
        return []

    proc_by = {(p["record_type"], p["hour"]): p for p in proc_rows}

    # traffic peak per record_type (proxy for the day's peak hour, over the window)
    peak: dict[str, float] = {}
    for r in raw_rows:
        rt = r["record_type"]
        peak[rt] = max(peak.get(rt, 0.0), float(r["raw_count"] or 0))

    out: list[schemas.VerdictRow] = []
    for r in raw_rows:
        rt, hour = r["record_type"], r["hour"]
        raw_count = int(r["raw_count"] or 0)
        matched = int(r["matched"] or 0)
        catchup = int(r["catchup"] or 0)
        raw_only = int(r["raw_only"] or 0)
        amt_mismatch = int(r["amt_mismatch"] or 0)
        raw_val = float(r["raw_val"] or 0.0)
        matched_val = float(r["matched_val"] or 0.0)

        pm = proc_by.get((rt, hour), {})
        proc_count = int(pm.get("proc_count") or 0)
        dup_count = int(pm.get("dup_count") or 0)
        proc_only = int(pm.get("proc_only") or 0)

        total_gap = catchup + raw_only
        count_gap_pct = total_gap / raw_count * 100 if raw_count else 0.0
        catchup_rate_pct = catchup / total_gap * 100 if total_gap else 0.0
        value_gap_pct = abs(raw_val - matched_val) / raw_val * 100 if raw_val > 0 else 0.0
        dup_rate_pct = dup_count / proc_count * 100 if proc_count else 0.0
        mismatch_rate_pct = amt_mismatch / matched * 100 if matched else 0.0
        traffic_pct = raw_count / peak[rt] * 100 if peak.get(rt) else 0.0

        scored = score(
            _RECON_PROFILE,
            {
                "count_gap": count_gap_pct,
                "value_gap": value_gap_pct,
                "dup_rate": dup_rate_pct,
                "catchup": catchup_rate_pct,
                "mismatch": mismatch_rate_pct,
                "traffic": traffic_pct,
            },
        )
        band_lo, band_hi = scored["band"]
        out.append(
            schemas.VerdictRow(
                recordType=rt,
                hour=hour,
                rawCount=raw_count,
                procCount=proc_count,
                matched=matched,
                catchup=catchup,
                rawOnly=raw_only,
                procOnly=proc_only,
                dupCount=dup_count,
                amtMismatch=amt_mismatch,
                countGapPct=round(count_gap_pct, 3),
                valueGapPct=round(value_gap_pct, 3),
                dupRatePct=round(dup_rate_pct, 3),
                catchupRatePct=round(catchup_rate_pct, 3),
                mismatchRatePct=round(mismatch_rate_pct, 3),
                trafficPct=round(traffic_pct, 3),
                verdict=scored["verdict"],
                score=scored["score"],
                bandLo=band_lo,
                bandHi=band_hi,
                similarity=scored["similarity"],
                drivers=[_fmt_driver(d) for d in scored["drivers"]],
            )
        )
    return out


# --- Cases -----------------------------------------------------------------
async def _next_case_reference(db: AsyncSession) -> str:
    count = (await db.execute(select(func.count(Case.id)))).scalar_one()
    return f"CASE-{2000 + int(count) + 1}"


def to_case_row(c: Case) -> schemas.CaseRow:
    return schemas.CaseRow(
        id=c.id,
        reference=c.reference,
        title=c.title,
        severity=c.severity,
        status=c.status,
        owner=c.owner,
        updated=c.updated_at,
        estimatedImpact=c.estimated_impact,
    )


async def list_cases(
    db: AsyncSession, *, status: str | None, limit: int, offset: int
) -> list[schemas.CaseRow]:
    stmt = select(Case).order_by(Case.updated_at.desc())
    if status:
        stmt = stmt.where(Case.status == status)
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return [to_case_row(c) for c in rows]


async def get_case(db: AsyncSession, case_id: str) -> schemas.CaseDetail:
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if case is None:
        raise NotFoundError("Case not found.")
    comments = await case.awaitable_attrs.comments
    return schemas.CaseDetail(
        **to_case_row(case).model_dump(),
        description=case.description,
        linkedTxnId=case.linked_txn_id,
        comments=[
            schemas.CaseComment(id=c.id, author=c.author, body=c.body, createdAt=c.created_at)
            for c in sorted(comments, key=lambda x: x.created_at)
        ],
    )


async def create_case(db: AsyncSession, payload: schemas.CaseCreate, *, owner_id: str) -> Case:
    case = Case(
        reference=await _next_case_reference(db),
        title=payload.title,
        description=payload.description,
        severity=payload.severity,
        status=payload.status,
        owner=payload.owner,
        owner_id=owner_id,
        linked_txn_id=payload.linkedTxnId,
        estimated_impact=payload.estimatedImpact,
    )
    db.add(case)
    await db.flush()
    await db.refresh(case)
    return case


async def update_case(db: AsyncSession, case_id: str, payload: schemas.CaseUpdate) -> Case:
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if case is None:
        raise NotFoundError("Case not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        attr = {"estimatedImpact": "estimated_impact"}.get(field, field)
        setattr(case, attr, value)
    await db.flush()
    await db.refresh(case)
    return case


async def add_comment(
    db: AsyncSession, case_id: str, body: str, *, author: str
) -> schemas.CaseComment:
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if case is None:
        raise NotFoundError("Case not found.")
    comment = CaseComment(case_id=case_id, author=author, body=body, created_at=datetime.now(UTC))
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return schemas.CaseComment(
        id=comment.id, author=comment.author, body=comment.body, createdAt=comment.created_at
    )


# --- Workbench -------------------------------------------------------------
async def list_saved_queries(db: AsyncSession) -> list[schemas.SavedQueryRow]:
    rows = (
        (await db.execute(select(SavedQuery).order_by(SavedQuery.created_at.desc())))
        .scalars()
        .all()
    )
    return [
        schemas.SavedQueryRow(
            id=q.id, reference=q.reference, name=q.name, owner=q.owner, count=q.last_count
        )
        for q in rows
    ]


async def create_saved_query(
    db: AsyncSession, payload: schemas.SavedQueryCreate, *, owner: str
) -> SavedQuery:
    count = (await db.execute(select(func.count(SavedQuery.id)))).scalar_one()
    query = SavedQuery(
        reference=f"Q-{500 + int(count) + 1}",
        name=payload.name,
        owner=owner,
        definition=payload.definition,
        last_count=0,
    )
    db.add(query)
    await db.flush()
    await db.refresh(query)
    return query


async def workbench_stats(db: AsyncSession) -> schemas.WorkbenchStats:
    open_count = (
        await db.execute(select(func.count(Case.id)).where(Case.status == "Open"))
    ).scalar_one()
    week_ago = datetime.now(UTC) - timedelta(days=7)
    closed = (
        await db.execute(
            select(func.count(Case.id)).where(
                Case.status.in_(["Closed", "Resolved"]), Case.updated_at >= week_ago
            )
        )
    ).scalar_one()
    # Real avg resolution time (days) across resolved cases; 0 when none yet.
    avg_secs = (
        await db.execute(
            select(func.avg(func.extract("epoch", Case.updated_at - Case.created_at))).where(
                Case.status.in_(["Closed", "Resolved"])
            )
        )
    ).scalar_one()
    return schemas.WorkbenchStats(
        openInvestigations=int(open_count),
        closedThisWeek=int(closed),
        avgResolutionDays=round(float(avg_secs) / 86400, 1) if avg_secs else 0.0,
    )
