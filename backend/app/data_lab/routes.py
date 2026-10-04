from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_researcher, verify_origin
from app.data_lab import config, sessions
from app.data_lab.runtime import LabUnavailable
from app.database import get_db
from app.models import Dataset, User
from app.schemas import (
    DataLabExecuteRequest,
    DataLabResult,
    DataLabSession,
    DataLabSessionRequest,
    DataLabStarterCell,
    DataLabStatus,
)

router = APIRouter(prefix="/api/data-lab", dependencies=[Depends(verify_origin)])

# Running code needs all three: the Data Lab is enabled, the person is signed
# in, and their role is researcher or admin. Each request is checked here.

SESSION_ID = re.compile(r"^[0-9a-f]{32}$")
SESSION_ENDED = "This session was not found or has ended. Start a new session."


def _require_enabled() -> None:
    if not config.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Polar Data Lab is not enabled.",
        )


def _require_session_id(session_id: str) -> None:
    if not SESSION_ID.match(session_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=SESSION_ENDED)


@router.get("/status", response_model=DataLabStatus)
def get_status() -> DataLabStatus:
    return DataLabStatus(
        enabled=config.is_enabled(),
        supported_file_types=list(config.LAB_FILE_TYPES),
        cell_timeout_seconds=config.cell_timeout_seconds(),
        idle_timeout_minutes=config.idle_timeout_minutes(),
    )


@router.post(
    "/sessions",
    response_model=DataLabSession,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: DataLabSessionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_researcher),
) -> DataLabSession:
    _require_enabled()
    dataset = db.get(Dataset, payload.dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

    try:
        session = sessions.create_session(dataset, user.id)
    except sessions.DatasetNotSupported as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error
    except sessions.TooManySessions as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many analysis sessions are running. End one and try again.",
        ) from error
    except LabUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error

    return DataLabSession(
        session_id=session.id,
        dataset_id=session.dataset_id,
        dataset_title=session.dataset_title,
        file_type=session.file_type,
        data_path=session.data_path,
        starter_cells=[
            DataLabStarterCell(**cell) for cell in sessions.starter_cells(session.file_type)
        ],
        cell_timeout_seconds=config.cell_timeout_seconds(),
        idle_timeout_minutes=config.idle_timeout_minutes(),
        created_at=session.created_at,
    )


@router.post("/sessions/{session_id}/execute", response_model=DataLabResult)
def execute(
    session_id: str,
    payload: DataLabExecuteRequest,
    user: User = Depends(require_researcher),
) -> DataLabResult:
    _require_enabled()
    _require_session_id(session_id)
    if not payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Code cannot be empty",
        )

    try:
        result = sessions.execute_cell(session_id, payload.code, user.id)
    except sessions.SessionNotFound as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SESSION_ENDED,
        ) from error
    return DataLabResult.model_validate(result)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def end_session(
    session_id: str,
    user: User = Depends(require_researcher),
) -> Response:
    _require_enabled()
    _require_session_id(session_id)
    if not sessions.end_session(session_id, user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=SESSION_ENDED)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
