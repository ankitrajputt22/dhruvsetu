from __future__ import annotations

import os

SESSION_COOKIE = "dhruvsetu_session"
MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 128

# Failed logins allowed for one email address before a short pause.
LOGIN_ATTEMPT_LIMIT = 5
LOGIN_ATTEMPT_WINDOW_SECONDS = 300

DEFAULT_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def session_expire_minutes() -> int:
    try:
        value = int(os.getenv("SESSION_EXPIRE_MINUTES", "").strip() or 480)
    except ValueError:
        value = 480
    return max(5, min(value, 60 * 24 * 30))


def cookie_secure() -> bool:
    """Send the session cookie over HTTPS only. Turn on in production."""
    return os.getenv("AUTH_COOKIE_SECURE", "").strip().lower() in {"1", "true", "yes", "on"}


def allowed_origins() -> tuple[str, ...]:
    """Sites that may send state-changing requests with a session cookie."""
    configured = [
        item.strip().rstrip("/")
        for item in os.getenv("FRONTEND_ORIGINS", "").split(",")
        if item.strip()
    ]
    return tuple(configured) or DEFAULT_ORIGINS
