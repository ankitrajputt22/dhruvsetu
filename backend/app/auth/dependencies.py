from __future__ import annotations

from urllib.parse import urlsplit

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth import config
from app.auth.sessions import user_for_token
from app.database import get_db
from app.models import User

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=config.SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> User | None:
    """The signed-in user, or None. The role always comes from the database."""
    return user_for_token(db, session_token)


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in to continue.",
        )
    return user


def require_role(*roles: str):
    """Build a dependency that allows only the given roles."""

    def check(user: User = Depends(require_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account does not have permission for this.",
            )
        return user

    return check


require_admin = require_role("admin")
require_researcher = require_role("researcher", "admin")


def verify_origin(request: Request) -> None:
    """Reject state-changing requests that a browser sent from another site.

    The session cookie is SameSite=Lax, which already keeps it off cross-site
    requests. This is a second check: when a browser says where a request came
    from, it must be the DhruvSetu frontend. Requests without an Origin or
    Referer header do not come from a browser page and carry no ambient cookie.
    """
    if request.method in SAFE_METHODS:
        return
    source = request.headers.get("origin")
    if source is None:
        referer = request.headers.get("referer")
        if referer is None:
            return
        parts = urlsplit(referer)
        source = f"{parts.scheme}://{parts.netloc}"
    if source.rstrip("/") not in config.allowed_origins():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This request did not come from the DhruvSetu site.",
        )
