from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.admin import records
from app.auth.dependencies import require_admin, verify_origin
from app.auth.sessions import end_all_sessions_for
from app.database import get_db
from app.models import User
from app.schemas import (
    AdminRecord,
    AdminRecordDetail,
    AdminRecordFact,
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
        # The account signs in again and gets its new permissions.
        end_all_sessions_for(db, user.id)
        db.commit()
    return AdminUser.model_validate(user)
