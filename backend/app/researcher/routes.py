from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_researcher, require_user, verify_origin
from app.database import get_db
from app.models import User
from app.researcher import requests, submissions
from app.researcher.uploads import UploadRejected, read_upload
from app.schemas import (
    DatasetSubmission,
    DocumentSubmission,
    ResearcherAccess,
    ResearcherAccessDetails,
    ResearcherRequestOwn,
    SubmissionItem,
)

# A signed-in person asks for researcher access here and sees what happened
# to the request. Deciding a request is an admin route.
access_router = APIRouter(
    prefix="/api/researcher-access",
    dependencies=[Depends(verify_origin)],
)

# The Research Workspace. Every route needs the researcher or admin role,
# checked on the server before anything is read from the request.
workspace_router = APIRouter(
    prefix="/api/researcher",
    dependencies=[Depends(verify_origin), Depends(require_researcher)],
)


def _access(user: User) -> ResearcherAccess:
    return ResearcherAccess(
        role=user.role,
        access_status=requests.access_status(user),
        can_request=requests.can_request(user),
        requests=[
            ResearcherRequestOwn.model_validate(request)
            for request in user.researcher_requests
        ],
    )


@access_router.get("", response_model=ResearcherAccess)
def get_researcher_access(user: User = Depends(require_user)) -> ResearcherAccess:
    return _access(user)


@access_router.post("", response_model=ResearcherAccess, status_code=status.HTTP_201_CREATED)
def request_researcher_access(
    payload: ResearcherAccessDetails,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> ResearcherAccess:
    try:
        requests.create_request(db, user, payload)
    except requests.RequestNotAllowed as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    return _access(user)


@workspace_router.get("/submissions", response_model=list[SubmissionItem])
def get_submissions(
    user: User = Depends(require_researcher),
    db: Session = Depends(get_db),
) -> list[SubmissionItem]:
    return submissions.list_submissions(db, user)


def _details(model: type[BaseModel], fields: dict[str, str]):
    try:
        return model.model_validate(fields)
    except ValidationError as error:
        raise RequestValidationError(
            error.errors(include_url=False, include_context=False, include_input=False)
        ) from error


async def _submit(request: Request, *, max_bytes: int, model: type[BaseModel], store, db, user):
    try:
        fields, upload = await read_upload(request, max_file_bytes=max_bytes)
        details = _details(model, fields)
        # Reading files and the database is ordinary blocking work.
        record = await run_in_threadpool(store, db, user, details, upload)
    except (UploadRejected, submissions.SubmissionRejected) as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    return submissions.submission_item(record)


@workspace_router.post(
    "/documents", response_model=SubmissionItem, status_code=status.HTTP_201_CREATED
)
async def submit_document(
    request: Request,
    user: User = Depends(require_researcher),
    db: Session = Depends(get_db),
) -> SubmissionItem:
    return await _submit(
        request,
        max_bytes=submissions.MAX_DOCUMENT_BYTES,
        model=DocumentSubmission,
        store=submissions.submit_document,
        db=db,
        user=user,
    )


@workspace_router.post(
    "/datasets", response_model=SubmissionItem, status_code=status.HTTP_201_CREATED
)
async def submit_dataset(
    request: Request,
    user: User = Depends(require_researcher),
    db: Session = Depends(get_db),
) -> SubmissionItem:
    return await _submit(
        request,
        max_bytes=submissions.MAX_DATASET_BYTES,
        model=DatasetSubmission,
        store=submissions.submit_dataset,
        db=db,
        user=user,
    )
