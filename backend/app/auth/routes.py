from __future__ import annotations

import logging
import time
from collections import defaultdict

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import config
from app.auth.dependencies import require_user, verify_origin
from app.auth.passwords import hash_password, verify_password
from app.auth.sessions import create_session, end_session
from app.database import get_db
from app.models import User
from app.schemas import AuthLogin, AuthRegister, AuthUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", dependencies=[Depends(verify_origin)])

LOGIN_FAILED = "Email or password is incorrect."

# Recent failed logins per email address, kept in this process only.
_failed_logins: dict[str, list[float]] = defaultdict(list)


def reset_login_attempts() -> None:
    _failed_logins.clear()


def _too_many_attempts(email: str) -> bool:
    cutoff = time.monotonic() - config.LOGIN_ATTEMPT_WINDOW_SECONDS
    recent = [moment for moment in _failed_logins[email] if moment > cutoff]
    _failed_logins[email] = recent
    return len(recent) >= config.LOGIN_ATTEMPT_LIMIT


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=config.SESSION_COOKIE,
        value=token,
        max_age=config.session_expire_minutes() * 60,
        httponly=True,
        samesite="lax",
        secure=config.cookie_secure(),
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=config.SESSION_COOKIE,
        httponly=True,
        samesite="lax",
        secure=config.cookie_secure(),
        path="/",
    )


@router.post("/register", response_model=AuthUser, status_code=status.HTTP_201_CREATED)
def register(
    payload: AuthRegister,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthUser:
    email = payload.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Every account made here is a normal user. Other roles are given by an
    # admin or by the setup command, never by the person registering.
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=(payload.display_name or "").strip() or None,
        role="user",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from error

    token, _ = create_session(db, user)
    _set_session_cookie(response, token)
    return AuthUser.model_validate(user)


@router.post("/login", response_model=AuthUser)
def login(
    payload: AuthLogin,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthUser:
    email = payload.email.strip().lower()
    if _too_many_attempts(email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please wait a few minutes and try again.",
        )

    user = db.scalar(select(User).where(User.email == email))
    password_matches = verify_password(
        payload.password, user.password_hash if user else None
    )
    # One message for every failure, so it does not reveal which accounts exist.
    if user is None or not password_matches or not user.is_active:
        _failed_logins[email].append(time.monotonic())
        logger.info("Failed login attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=LOGIN_FAILED,
        )

    _failed_logins.pop(email, None)
    token, _ = create_session(db, user)
    _set_session_cookie(response, token)
    return AuthUser.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    session_token: str | None = Cookie(default=None, alias=config.SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> Response:
    # The session is removed from the database, so the token stops working
    # even if a copy of the cookie still exists somewhere.
    end_session(db, session_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_session_cookie(response)
    return response


@router.get("/me", response_model=AuthUser)
def me(user: User = Depends(require_user)) -> AuthUser:
    return AuthUser.model_validate(user)
