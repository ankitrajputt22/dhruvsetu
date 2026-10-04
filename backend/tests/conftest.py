from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.auth.passwords import hash_password
from app.auth.routes import reset_login_attempts
from app.database import SessionLocal
from app.main import app
from app.models import User, VerificationChange

@pytest.fixture(scope="session", autouse=True)
def demo_fixtures(tmp_path_factory):
    """Demo records exist while the tests run, and are removed afterwards.

    The real starter repository holds no demo records. Tests that cover the
    Demo Data label and connected records use these temporary ones.
    """
    from demo_data import load_demo_fixtures, unload_demo_fixtures

    load_demo_fixtures(tmp_path_factory.mktemp("demo-documents"))
    try:
        yield
    finally:
        unload_demo_fixtures()


# Used only for accounts that tests create and delete again.
TEST_PASSWORD = "test-only-password-1"
_PASSWORD_HASH = hash_password(TEST_PASSWORD)


def create_test_user(role: str = "user", *, active: bool = True) -> SimpleNamespace:
    email = f"test-{role}-{uuid4().hex[:12]}@dhruvsetu.test"
    with SessionLocal() as session:
        user = User(
            email=email,
            password_hash=_PASSWORD_HASH,
            display_name=f"Test {role.capitalize()}",
            role=role,
            is_active=active,
        )
        session.add(user)
        session.commit()
        return SimpleNamespace(id=user.id, email=email, password=TEST_PASSWORD, role=role)


def delete_test_users(user_ids: list[str]) -> None:
    if not user_ids:
        return
    with SessionLocal() as session:
        session.execute(
            delete(VerificationChange).where(
                VerificationChange.changed_by_user_id.in_(user_ids)
            )
        )
        session.execute(delete(User).where(User.id.in_(user_ids)))
        session.commit()


def log_in(client: TestClient, user: SimpleNamespace):
    return client.post(
        "/api/auth/login",
        json={"email": user.email, "password": user.password},
    )


@pytest.fixture(autouse=True)
def _fresh_login_attempts():
    reset_login_attempts()
    yield
    reset_login_attempts()


@pytest.fixture
def make_user():
    """Create temporary accounts and remove them after the test."""
    created: list[str] = []

    def create(role: str = "user", *, active: bool = True) -> SimpleNamespace:
        user = create_test_user(role, active=active)
        created.append(user.id)
        return user

    try:
        yield create
    finally:
        delete_test_users(created)


@pytest.fixture
def client_as(make_user):
    """Return a client signed in as a new account with the given role."""

    def create(role: str) -> TestClient:
        user = make_user(role)
        client = TestClient(app)
        assert log_in(client, user).status_code == 200
        client.user = user
        return client

    return create
