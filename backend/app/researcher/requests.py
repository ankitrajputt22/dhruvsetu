"""Requests for researcher access and the decisions admins make on them."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.sessions import end_all_sessions_for, now
from app.models import ResearcherAccessRequest, User
from app.schemas import ResearcherAccessDetails

MANUAL_PROMOTION_NOTE = "Researcher role given on the Users page."


class RequestNotAllowed(Exception):
    """A new request cannot be made now. The message is safe to show."""


class DecisionForbidden(Exception):
    """This admin may not decide this request. The message is safe to show."""


class DecisionConflict(Exception):
    """The request was already decided. The message is safe to show."""


def access_status(user: User) -> str:
    """Where the account stands, in one word.

    The role decides what the account can do. The requests only explain how
    it got there, so a pending request never counts as researcher access.
    """
    if user.role in ("researcher", "admin"):
        return "approved"
    if not user.researcher_requests:
        return "none"
    latest = user.researcher_requests[0].status
    # An approved request on a normal user means the access was taken away later.
    return "removed" if latest == "approved" else latest


def can_request(user: User) -> bool:
    return user.role == "user" and all(
        request.status != "pending" for request in user.researcher_requests
    )


def create_request(
    db: Session,
    user: User,
    details: ResearcherAccessDetails,
) -> ResearcherAccessRequest:
    # The account row is locked so that two requests sent at the same moment
    # cannot both become pending.
    db.execute(select(User.id).where(User.id == user.id).with_for_update())
    db.refresh(user)
    if user.role != "user":
        raise RequestNotAllowed("Your account already has researcher access.")
    if not can_request(user):
        raise RequestNotAllowed("You already have a request waiting for review.")

    request = ResearcherAccessRequest(
        user_id=user.id,
        institution=details.institution,
        research_area=details.research_area,
        designation=details.designation,
        reason=details.reason,
        profile_url=details.profile_url,
    )
    db.add(request)
    db.commit()
    db.refresh(user)
    return request


def list_requests(db: Session, status: str | None) -> list[ResearcherAccessRequest]:
    query = (
        select(ResearcherAccessRequest)
        .options(selectinload(ResearcherAccessRequest.user))
        .order_by(ResearcherAccessRequest.created_at.desc(), ResearcherAccessRequest.id)
        .limit(200)
    )
    if status is not None:
        query = query.where(ResearcherAccessRequest.status == status)
    return list(db.scalars(query).all())


def get_request(db: Session, request_id: str) -> ResearcherAccessRequest | None:
    return db.get(ResearcherAccessRequest, request_id)


def decide(
    db: Session,
    request_id: str,
    admin: User,
    *,
    approve: bool,
    note: str | None,
) -> ResearcherAccessRequest:
    """Approve or reject a pending request.

    The status, the role and the ended sessions are saved together, so a
    request can never be approved while the account stays a normal user.
    """
    request = db.scalar(
        select(ResearcherAccessRequest)
        .where(ResearcherAccessRequest.id == request_id)
        .with_for_update()
    )
    if request is None:
        raise LookupError("This request was not found.")
    if request.user_id == admin.id:
        raise DecisionForbidden("You cannot decide your own request.")
    if request.status != "pending":
        raise DecisionConflict(f"This request was already {request.status}.")

    request.status = "approved" if approve else "rejected"
    request.decided_by_user_id = admin.id
    request.decided_at = now()
    request.decision_note = note
    if approve:
        applicant = request.user
        if applicant.role == "user":
            applicant.role = "researcher"
        # The person signs in again and gets the new permissions.
        end_all_sessions_for(db, applicant.id)
    db.commit()
    return request


def record_manual_promotion(db: Session, user: User, admin: User) -> None:
    """Keep requests in step when an admin gives the role on the Users page.

    A pending request is marked approved by that admin, so an account is never
    a researcher while its request still says pending. Nothing is committed here.
    """
    for request in user.researcher_requests:
        if request.status == "pending":
            request.status = "approved"
            request.decided_by_user_id = admin.id
            request.decided_at = now()
            request.decision_note = MANUAL_PROMOTION_NOTE
