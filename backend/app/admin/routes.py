from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.admin import records
from app.auth.dependencies import require_admin, verify_origin
from app.auth.sessions import end_all_sessions_for
from app.database import get_db
from app.models import ResearcherAccessRequest, User
from app.researcher import requests as researcher_requests
from app.schemas import (
    AdminRecord,
    AdminRecordDetail,
    AdminRecordFact,
    AdminResearcherApplicant,
    AdminResearcherDecision,
    AdminResearcherDecisionRecord,
    AdminResearcherRequest,
    AdminResearcherRequestDetail,
    AdminStatusCount,
    AdminUser,
    AdminUserRoleUpdate,
    AdminVerificationChange,
    AdminVerificationUpdate,
)

# Every route here needs a signed-in admin. The check runs on the server for
# each request, whatever the frontend shows or hides.
router = APIRouter(
    prefix="/api/admin",
    dependencies=[Depends(verify_origin), Depends(require_admin)],
)

RecordTypeName = Literal[
    "expedition", "publication", "report", "dataset", "document", "station", "media"
]
StatusName = Literal["uploaded", "reviewed", "verified"]


def _record_or_404(db: Session, record_type: str, record_id: str):
    record = records.get_record(db, record_type, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This record was not found.",
        )
    return record


def _detail(db: Session, record_type: str, record) -> AdminRecordDetail:
    detail = records.record_detail(db, record_type, record)
    return AdminRecordDetail(
        **AdminRecord.model_validate(detail.summary).model_dump(),
        description=detail.description,
        facts=[AdminRecordFact(label=label, value=value) for label, value in detail.facts],
        related_resources=detail.related_resources,
        href=detail.href,
        changes=[
            AdminVerificationChange(
                from_status=change.from_status,
                to_status=change.to_status,
                changed_at=change.changed_at,
                changed_by=(
                    (change.changed_by.display_name or change.changed_by.email)
                    if change.changed_by
                    else None
                ),
            )
            for change in records.changes_for(db, record_type, record.id)
        ],
    )


@router.get("/summary", response_model=list[AdminStatusCount])
def get_summary(db: Session = Depends(get_db)) -> list[AdminStatusCount]:
    return [AdminStatusCount(**row) for row in records.count_by_status(db)]


@router.get("/records", response_model=list[AdminRecord])
def list_records(
    verification_status: Annotated[StatusName, Query(alias="status")] = "uploaded",
    record_type: Annotated[RecordTypeName | None, Query(alias="type")] = None,
    db: Session = Depends(get_db),
) -> list[AdminRecord]:
    return [
        AdminRecord.model_validate(record)
        for record in records.list_records(db, verification_status, record_type)
    ]


@router.get("/records/{record_type}/{record_id}", response_model=AdminRecordDetail)
def get_record(
    record_type: RecordTypeName,
    record_id: str,
    db: Session = Depends(get_db),
) -> AdminRecordDetail:
    return _detail(db, record_type, _record_or_404(db, record_type, record_id))


@router.patch(
    "/records/{record_type}/{record_id}/verification",
    response_model=AdminRecordDetail,
)
def update_verification(
    record_type: RecordTypeName,
    record_id: str,
    payload: AdminVerificationUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminRecordDetail:
    record = _record_or_404(db, record_type, record_id)
    try:
        records.change_status(db, record_type, record, payload.status, admin)
    except records.InvalidTransition as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    return _detail(db, record_type, record)


@router.get("/users", response_model=list[AdminUser])
def list_users(db: Session = Depends(get_db)) -> list[AdminUser]:
    users = db.scalars(select(User).order_by(User.email)).all()
    return [AdminUser.model_validate(user) for user in users]


@router.patch("/users/{user_id}/role", response_model=AdminUser)
def update_user_role(
    user_id: str,
    payload: AdminUserRoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUser:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This account was not found.",
        )
    # Admin accounts are only made or changed by the setup command, so an
    # admin can never be removed, or the last one lost, from this page.
    if user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Admin accounts cannot be changed here.",
        )
    if user.role != payload.role:
        user.role = payload.role
        if payload.role == "researcher":
            # A waiting request is marked approved, so the request and the
            # role never disagree. Requests are untouched when a role is removed.
            researcher_requests.record_manual_promotion(db, user, admin)
        # The account signs in again and gets its new permissions.
        end_all_sessions_for(db, user.id)
        db.commit()
    return AdminUser.model_validate(user)


RequestStatusFilter = Literal["pending", "approved", "rejected", "all"]


def _person(user: User | None) -> str | None:
    return (user.display_name or user.email) if user is not None else None


def _request_summary(request: ResearcherAccessRequest) -> dict:
    return {
        "id": request.id,
        "status": request.status,
        "applicant": AdminResearcherApplicant.model_validate(request.user),
        "institution": request.institution,
        "research_area": request.research_area,
        "designation": request.designation,
        "created_at": request.created_at,
    }


def _request_detail(request: ResearcherAccessRequest) -> AdminResearcherRequestDetail:
    return AdminResearcherRequestDetail(
        **_request_summary(request),
        reason=request.reason,
        profile_url=request.profile_url,
        decided_at=request.decided_at,
        decided_by=_person(request.decided_by),
        decision_note=request.decision_note,
        other_requests=[
            AdminResearcherDecisionRecord(
                id=other.id,
                status=other.status,
                created_at=other.created_at,
                decided_at=other.decided_at,
                decided_by=_person(other.decided_by),
                decision_note=other.decision_note,
            )
            for other in request.user.researcher_requests
            if other.id != request.id
        ],
    )


@router.get("/researcher-requests", response_model=list[AdminResearcherRequest])
def list_researcher_requests(
    request_status: Annotated[RequestStatusFilter, Query(alias="status")] = "pending",
    db: Session = Depends(get_db),
) -> list[AdminResearcherRequest]:
    found = researcher_requests.list_requests(
        db, None if request_status == "all" else request_status
    )
    return [AdminResearcherRequest(**_request_summary(request)) for request in found]


def _researcher_request_or_404(db: Session, request_id: str) -> ResearcherAccessRequest:
    request = researcher_requests.get_request(db, request_id)
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This request was not found.",
        )
    return request


@router.get("/researcher-requests/{request_id}", response_model=AdminResearcherRequestDetail)
def get_researcher_request(
    request_id: str,
    db: Session = Depends(get_db),
) -> AdminResearcherRequestDetail:
    return _request_detail(_researcher_request_or_404(db, request_id))


def _decide(
    db: Session,
    request_id: str,
    admin: User,
    payload: AdminResearcherDecision,
    *,
    approve: bool,
) -> AdminResearcherRequestDetail:
    _researcher_request_or_404(db, request_id)
    try:
        request = researcher_requests.decide(
            db, request_id, admin, approve=approve, note=payload.note
        )
    except researcher_requests.DecisionForbidden as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(error)
        ) from error
    except researcher_requests.DecisionConflict as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    return _request_detail(request)


@router.post(
    "/researcher-requests/{request_id}/approve",
    response_model=AdminResearcherRequestDetail,
)
def approve_researcher_request(
    request_id: str,
    payload: AdminResearcherDecision,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminResearcherRequestDetail:
    return _decide(db, request_id, admin, payload, approve=True)


@router.post(
    "/researcher-requests/{request_id}/reject",
    response_model=AdminResearcherRequestDetail,
)
def reject_researcher_request(
    request_id: str,
    payload: AdminResearcherDecision,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminResearcherRequestDetail:
    return _decide(db, request_id, admin, payload, approve=False)
