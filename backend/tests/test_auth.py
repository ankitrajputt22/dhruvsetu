import hashlib
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.auth import config
from app.auth.passwords import hash_password, verify_password
from app.auth.sessions import now
from app.database import SessionLocal
from app.main import app
from app.models import User, UserSession
from conftest import TEST_PASSWORD, log_in

LOGIN_FAILED = {"detail": "Email or password is incorrect."}


@pytest.fixture
def registered_emails():
    """Accounts made through the register endpoint are removed afterwards."""
    emails: list[str] = []
    try:
        yield emails
    finally:
        with SessionLocal() as session:
            session.execute(delete(User).where(User.email.in_(emails)))
            session.commit()


def _new_email() -> str:
    return f"test-register-{uuid4().hex[:12]}@dhruvsetu.test"


def _session_cookie_header(response) -> str:
    return next(
        value
        for name, value in response.headers.multi_items()
        if name == "set-cookie" and value.startswith(config.SESSION_COOKIE)
    )


def test_registration_creates_a_normal_user_and_signs_in(registered_emails) -> None:
    email = _new_email()
    registered_emails.append(email)
    client = TestClient(app)

    response = client.post(
        "/api/auth/register",
        json={"email": email.upper(), "password": TEST_PASSWORD, "display_name": " Test Person "},
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "email", "display_name", "role"}
    assert body["email"] == email
    assert body["display_name"] == "Test Person"
    assert body["role"] == "user"
    assert TEST_PASSWORD not in response.text
    assert client.get("/api/auth/me").json() == body


def test_registration_rejects_bad_input(registered_emails) -> None:
    email = _new_email()
    registered_emails.append(email)
    client = TestClient(app)
    first = client.post("/api/auth/register", json={"email": email, "password": TEST_PASSWORD})

    duplicate = TestClient(app).post(
        "/api/auth/register", json={"email": email, "password": TEST_PASSWORD}
    )
    short = TestClient(app).post(
        "/api/auth/register", json={"email": _new_email(), "password": "short"}
    )
    bad_email = TestClient(app).post(
        "/api/auth/register", json={"email": "not-an-email", "password": TEST_PASSWORD}
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert short.status_code == 422
    assert bad_email.status_code == 422


def test_password_is_stored_only_as_an_argon2_hash(make_user) -> None:
    user = make_user("user")

    with SessionLocal() as session:
        stored = session.get(User, user.id).password_hash

    assert stored.startswith("$argon2id$")
    assert TEST_PASSWORD not in stored
    assert verify_password(TEST_PASSWORD, stored) is True
    assert verify_password("another password", stored) is False
    assert verify_password(TEST_PASSWORD, None) is False
    # The same password never gives the same hash twice.
    assert hash_password(TEST_PASSWORD) != hash_password(TEST_PASSWORD)


def test_login_sets_a_safe_session_cookie(make_user, monkeypatch) -> None:
    user = make_user("researcher")
    client = TestClient(app)

    response = log_in(client, user)

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "email": user.email,
        "display_name": "Test Researcher",
        "role": "researcher",
    }
    cookie = _session_cookie_header(response).lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert f"max-age={config.session_expire_minutes() * 60}" in cookie
    assert "secure" not in cookie

    # Only a hash of the token is kept in the database.
    token = client.cookies.get(config.SESSION_COOKIE)
    with SessionLocal() as session:
        stored = session.scalars(
            select(UserSession.token_hash).where(UserSession.user_id == user.id)
        ).all()
    assert stored == [hashlib.sha256(token.encode()).hexdigest()]
    assert token not in stored

    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    secure = _session_cookie_header(log_in(TestClient(app), user)).lower()
    assert "secure" in secure


def test_me_returns_only_safe_account_details(client_as) -> None:
    client = client_as("admin")

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": client.user.id,
        "email": client.user.email,
        "display_name": "Test Admin",
        "role": "admin",
    }
    assert "password" not in response.text
    assert "argon2" not in response.text


def test_failed_logins_do_not_reveal_which_accounts_exist(make_user) -> None:
    user = make_user("user")
    inactive = make_user("user", active=False)

    wrong_password = TestClient(app).post(
        "/api/auth/login", json={"email": user.email, "password": "wrong-password-1"}
    )
    unknown_account = TestClient(app).post(
        "/api/auth/login",
        json={"email": "nobody@dhruvsetu.test", "password": TEST_PASSWORD},
    )
    inactive_account = log_in(TestClient(app), inactive)

    for response in (wrong_password, unknown_account, inactive_account):
        assert response.status_code == 401
        assert response.json() == LOGIN_FAILED
        assert "set-cookie" not in response.headers


def test_inactive_account_loses_access_at_once(client_as) -> None:
    client = client_as("researcher")
    assert client.get("/api/auth/me").status_code == 200

    with SessionLocal() as session:
        session.get(User, client.user.id).is_active = False
        session.commit()

    assert client.get("/api/auth/me").status_code == 401


def test_logout_ends_the_session(client_as) -> None:
    client = client_as("user")
    token = client.cookies.get(config.SESSION_COOKIE)

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert client.cookies.get(config.SESSION_COOKIE) is None
    assert client.get("/api/auth/me").status_code == 401
    with SessionLocal() as session:
        assert session.scalars(
            select(UserSession).where(UserSession.user_id == client.user.id)
        ).all() == []
    # A copy of the old cookie no longer works.
    replay = TestClient(app, cookies={config.SESSION_COOKIE: token})
    assert replay.get("/api/auth/me").status_code == 401


def test_missing_invalid_and_expired_sessions_are_rejected(client_as) -> None:
    anonymous = TestClient(app).get("/api/auth/me")
    forged = TestClient(app, cookies={config.SESSION_COOKIE: "not-a-real-session"})
    client = client_as("user")
    with SessionLocal() as session:
        stored = session.scalar(
            select(UserSession).where(UserSession.user_id == client.user.id)
        )
        stored.expires_at = now() - timedelta(minutes=1)
        session.commit()

    assert anonymous.status_code == 401
    assert anonymous.json() == {"detail": "Please log in to continue."}
    assert forged.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_repeated_failed_logins_are_paused(make_user) -> None:
    user = make_user("user")
    client = TestClient(app)

    for _ in range(config.LOGIN_ATTEMPT_LIMIT):
        attempt = client.post(
            "/api/auth/login", json={"email": user.email, "password": "wrong-password-1"}
        )
        assert attempt.status_code == 401

    blocked = log_in(client, user)

    assert blocked.status_code == 429
    assert "Too many failed attempts" in blocked.json()["detail"]


def test_requests_from_other_sites_are_refused(make_user, client_as) -> None:
    user = make_user("user")
    other_site = {"Origin": "https://example.com"}

    login = TestClient(app).post(
        "/api/auth/login",
        json={"email": user.email, "password": user.password},
        headers=other_site,
    )
    client = client_as("user")
    logout = client.post("/api/auth/logout", headers=other_site)
    by_referer = client.post(
        "/api/auth/logout", headers={"Referer": "https://example.com/page"}
    )

    assert login.status_code == 403
    assert logout.status_code == 403
    assert by_referer.status_code == 403
    # The session is still there, and the real site can use it.
    assert client.get("/api/auth/me").status_code == 200
    allowed = client.post("/api/auth/logout", headers={"Origin": "http://localhost:3000"})
    assert allowed.status_code == 204


def test_only_json_bodies_are_accepted(make_user) -> None:
    # A plain HTML form on another site can only send these body types.
    user = make_user("user")
    body = f'{{"email": "{user.email}", "password": "{user.password}"}}'
    client = TestClient(app)

    as_text = client.post(
        "/api/auth/login", content=body, headers={"Content-Type": "text/plain"}
    )
    as_form = client.post(
        "/api/auth/login", data={"email": user.email, "password": user.password}
    )

    assert as_text.status_code == 422
    assert as_form.status_code == 422
    assert config.SESSION_COOKIE not in client.cookies
