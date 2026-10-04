from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.auth import config
from app.models import User, UserSession


def now() -> datetime:
    """Current UTC time without a zone, as it is stored in MySQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user: User) -> tuple[str, datetime]:
    """Start a session and return the token for the cookie. Only its hash is stored."""
    db.execute(delete(UserSession).where(UserSession.expires_at <= now()))
    token = secrets.token_urlsafe(32)
    expires_at = now() + timedelta(minutes=config.session_expire_minutes())
    db.add(UserSession(user_id=user.id, token_hash=_hash(token), expires_at=expires_at))
    db.commit()
    return token, expires_at


def user_for_token(db: Session, token: str | None) -> User | None:
    """Return the signed-in user, or None for a missing, unknown or expired session."""
    if not token or len(token) > 200:
        return None
    session = db.scalar(
        select(UserSession)
        .where(UserSession.token_hash == _hash(token))
        .options(selectinload(UserSession.user))
    )
    if session is None or session.expires_at <= now():
        return None
    return session.user if session.user.is_active else None


def end_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == _hash(token)))
        db.commit()


def end_all_sessions_for(db: Session, user_id: str) -> None:
    db.execute(delete(UserSession).where(UserSession.user_id == user_id))
