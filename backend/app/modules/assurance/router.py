"""Assurance routes: /recon, /cases, /workbench."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, PageParams, Principal, require
from app.core.rbac import PermKey
from app.modules.assurance import schemas, service

# --- Reconciliation --------------------------------------------------------
recon_router = APIRouter(prefix="/recon", tags=["reconciliation"])


@recon_router.get("/summary", response_model=schemas.ReconSummary)
async def recon_summary(
    hours: int = Query(default=24, ge=1, le=720),
    _: Principal = Depends(require(PermKey.DASHBOARD, "view")),
) -> schemas.ReconSummary:
    return await service.recon_summary(hours=hours)


@recon_router.get("/records", response_model=list[schemas.ReconRecord])
async def recon_records(
    page: PageParams,
    status_filter: str | None = Query(default=None, alias="status"),
    _: Principal = Depends(require(PermKey.WORKBENCH, "view")),
) -> list[schemas.ReconRecord]:
    return await service.recon_records(status=status_filter, limit=page.limit, offset=page.offset)


@recon_router.get("/verdicts", response_model=list[schemas.VerdictRow])
async def recon_verdicts(
    hours: int = Query(default=48, ge=1, le=720),
    stream: str = Query(default="air"),
    _: Principal = Depends(require(PermKey.DASHBOARD, "view")),
) -> list[schemas.VerdictRow]:
    """Hourly IT2 + CWW verdicts (Healthy/Watch/Suspect/Critical) with uncertainty
    band and rule-trace, derived from the stream's raw/processed source unions."""
    return await service.recon_verdicts(stream=stream, hours=hours)


# --- Generic profile-driven verdicts (recon, file_sequence, …) -------------
verdicts_router = APIRouter(prefix="/verdicts", tags=["verdicts"])


@verdicts_router.get("/profiles", response_model=list[schemas.ProfileInfo])
async def verdict_profiles(
    _: Principal = Depends(require(PermKey.DASHBOARD, "view")),
) -> list[schemas.ProfileInfo]:
    """List every registered verdict profile + its display metadata."""
    return service.list_verdict_profiles()


@verdicts_router.get("", response_model=list[schemas.ProfileVerdictRow])
async def profile_verdicts(
    profile: str = Query(default="recon"),
    hours: int = Query(default=48, ge=1, le=720),
    _: Principal = Depends(require(PermKey.DASHBOARD, "view")),
) -> list[schemas.ProfileVerdictRow]:
    """Hourly IT2 + CWW verdicts for any report profile (verdict + band + rule trace)."""
    return await service.profile_verdicts(profile=profile, hours=hours)


@verdicts_router.get("/benchmark", response_model=schemas.BenchmarkReport)
async def verdict_benchmark(
    profile: str = Query(default="recon"),
    _: Principal = Depends(require(PermKey.DASHBOARD, "view")),
) -> schemas.BenchmarkReport:
    """Fuzzy vs crisp-threshold baseline on a labelled set (precision/recall/F1 +
    catch-up false alarms) — evidence the fuzzy layer earns its place."""
    return service.verdict_benchmark_report(profile)


# --- Cases -----------------------------------------------------------------
cases_router = APIRouter(prefix="/cases", tags=["cases"])


@cases_router.get("", response_model=list[schemas.CaseRow])
async def list_cases(
    db: DbSession,
    page: PageParams,
    status_filter: str | None = Query(default=None, alias="status"),
    _: Principal = Depends(require(PermKey.CASE_MANAGEMENT, "view")),
) -> list[schemas.CaseRow]:
    return await service.list_cases(db, status=status_filter, limit=page.limit, offset=page.offset)


@cases_router.post("", response_model=schemas.CaseRow, status_code=status.HTTP_201_CREATED)
async def create_case(
    payload: schemas.CaseCreate,
    db: DbSession,
    principal: Principal = Depends(require(PermKey.CASE_MANAGEMENT, "edit")),
) -> schemas.CaseRow:
    case = await service.create_case(db, payload, owner_id=principal.id)
    return service.to_case_row(case)


@cases_router.get("/{case_id}", response_model=schemas.CaseDetail)
async def get_case(
    case_id: str,
    db: DbSession,
    _: Principal = Depends(require(PermKey.CASE_MANAGEMENT, "view")),
) -> schemas.CaseDetail:
    return await service.get_case(db, case_id)


@cases_router.patch("/{case_id}", response_model=schemas.CaseRow)
async def update_case(
    case_id: str,
    payload: schemas.CaseUpdate,
    db: DbSession,
    _: Principal = Depends(require(PermKey.CASE_MANAGEMENT, "edit")),
) -> schemas.CaseRow:
    case = await service.update_case(db, case_id, payload)
    return service.to_case_row(case)


@cases_router.post(
    "/{case_id}/comments",
    response_model=schemas.CaseComment,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    case_id: str,
    payload: schemas.CommentCreate,
    db: DbSession,
    principal: Principal = Depends(require(PermKey.CASE_MANAGEMENT, "edit")),
) -> schemas.CaseComment:
    return await service.add_comment(db, case_id, payload.body, author=principal.email)


# --- Workbench -------------------------------------------------------------
workbench_router = APIRouter(prefix="/workbench", tags=["workbench"])


@workbench_router.get("/queries", response_model=list[schemas.SavedQueryRow])
async def list_queries(
    db: DbSession, _: Principal = Depends(require(PermKey.WORKBENCH, "view"))
) -> list[schemas.SavedQueryRow]:
    return await service.list_saved_queries(db)


@workbench_router.post(
    "/queries", response_model=schemas.SavedQueryRow, status_code=status.HTTP_201_CREATED
)
async def create_query(
    payload: schemas.SavedQueryCreate,
    db: DbSession,
    principal: Principal = Depends(require(PermKey.WORKBENCH, "edit")),
) -> schemas.SavedQueryRow:
    q = await service.create_saved_query(db, payload, owner=principal.full_name)
    return schemas.SavedQueryRow(
        id=q.id, reference=q.reference, name=q.name, owner=q.owner, count=q.last_count
    )


@workbench_router.get("/stats", response_model=schemas.WorkbenchStats)
async def stats(
    db: DbSession, _: Principal = Depends(require(PermKey.WORKBENCH, "view"))
) -> schemas.WorkbenchStats:
    return await service.workbench_stats(db)


router = APIRouter()
router.include_router(recon_router)
router.include_router(verdicts_router)
#router.include_router(cases_router)
#router.include_router(workbench_router)
