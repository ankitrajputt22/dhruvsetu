import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.data_lab import sessions
from app.database import SessionLocal
from app.main import app
from app.models import User, UserSession
from app.seed import DEMO_IDS
from demo_data import seed_demo_data
from conftest import TEST_PASSWORD, log_in

PREVIEW_ID = DEMO_IDS["datasets"]["preview"]
PUBLIC_PATHS = (
    "/api/expeditions",
    "/api/scientists",
    "/api/publications",
    "/api/datasets",
    "/api/documents",
    "/api/map",
    "/api/search?q=climate",
    "/api/outreach/sources?type=expedition",
    "/api/data-lab/status",
    "/health",
)
ADMIN_PATHS = ("/api/admin/summary", "/api/admin/records", "/api/admin/users")


class FakeProcess:
    alive = True

    def execute(self, code: str, timeout: int) -> dict:
        return {"status": "ok", "outputs": [{"type": "text", "stream": "result", "text": "2"}]}

    def stop(self) -> None:
        self.alive = False


@pytest.fixture
def lab(monkeypatch):
    """Data Lab enabled, with a fake runtime so no container is started."""
    with SessionLocal() as session:
        seed_demo_data(session)
    started: list[FakeProcess] = []

    def fake_start(*args):
        started.append(FakeProcess())
        return started[-1]

    monkeypatch.setenv("DATA_LAB_ENABLED", "true")
    monkeypatch.setattr(sessions, "start_container", fake_start)
    sessions.end_all_sessions()
    try:
        yield started
    finally:
        sessions.end_all_sessions()


def _open_lab(client: TestClient):
    return client.post("/api/data-lab/sessions", json={"dataset_id": PREVIEW_ID})


def test_anonymous_visitors_can_browse_but_not_run_code_or_administer(lab) -> None:
    client = TestClient(app)

    for path in PUBLIC_PATHS:
        assert client.get(path).status_code == 200, path
    opened = _open_lab(client)
    executed = client.post(f"/api/data-lab/sessions/{'0' * 32}/execute", json={"code": "1 + 1"})
    ended = client.delete(f"/api/data-lab/sessions/{'0' * 32}")

    for response in (opened, executed, ended):
        assert response.status_code == 401
    for path in ADMIN_PATHS:
        assert client.get(path).status_code == 401, path
    assert lab == []


def test_normal_users_can_browse_but_not_run_code_or_administer(lab, client_as) -> None:
    client = client_as("user")

    for path in PUBLIC_PATHS:
        assert client.get(path).status_code == 200, path
    opened = _open_lab(client)
    executed = client.post(f"/api/data-lab/sessions/{'0' * 32}/execute", json={"code": "1 + 1"})
    ended = client.delete(f"/api/data-lab/sessions/{'0' * 32}")

    for response in (opened, executed, ended):
        assert response.status_code == 403
        assert response.json() == {
            "detail": "Your account does not have permission for this."
        }
    for path in ADMIN_PATHS:
        assert client.get(path).status_code == 403, path
    assert lab == []


def test_researchers_can_use_the_data_lab_but_not_the_admin_area(lab, client_as) -> None:
    client = client_as("researcher")

    opened = _open_lab(client)
    session_id = opened.json()["session_id"]
    executed = client.post(f"/api/data-lab/sessions/{session_id}/execute", json={"code": "1 + 1"})
    ended = client.delete(f"/api/data-lab/sessions/{session_id}")

    assert opened.status_code == 201
    assert executed.status_code == 200
    assert ended.status_code == 204
    for path in ADMIN_PATHS:
        assert client.get(path).status_code == 403, path


def test_admins_can_use_the_data_lab_and_the_admin_area(lab, client_as) -> None:
    client = client_as("admin")

    opened = _open_lab(client)

    assert opened.status_code == 201
    for path in ADMIN_PATHS:
        assert client.get(path).status_code == 200, path


def test_data_lab_switch_still_applies_to_researchers(lab, client_as, monkeypatch) -> None:
    client = client_as("researcher")
    monkeypatch.setenv("DATA_LAB_ENABLED", "false")

    response = _open_lab(client)

    assert response.status_code == 403
    assert response.json() == {"detail": "Polar Data Lab is not enabled."}
    assert lab == []


def test_a_data_lab_session_belongs_to_the_account_that_started_it(lab, client_as) -> None:
    owner = client_as("researcher")
    other = client_as("researcher")
    session_id = _open_lab(owner).json()["session_id"]

    stolen_run = other.post(f"/api/data-lab/sessions/{session_id}/execute", json={"code": "1 + 1"})
    stolen_end = other.delete(f"/api/data-lab/sessions/{session_id}")

    assert stolen_run.status_code == 404
    assert stolen_end.status_code == 404
    assert lab[0].alive is True
    assert owner.post(
        f"/api/data-lab/sessions/{session_id}/execute", json={"code": "1 + 1"}
    ).status_code == 200


def test_registration_cannot_ask_for_a_role() -> None:
    email = "test-escalation@dhruvsetu.test"

    for role in ("admin", "researcher"):
        response = TestClient(app).post(
            "/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "role": role},
        )
        assert response.status_code == 422

    with SessionLocal() as session:
        assert session.scalar(select(User).where(User.email == email)) is None


def test_users_and_researchers_cannot_change_their_own_role(client_as) -> None:
    for role in ("user", "researcher"):
        client = client_as(role)
        own = f"/api/admin/users/{client.user.id}/role"

        through_admin_api = client.patch(own, json={"role": "researcher"})
        become_admin = client.patch(own, json={"role": "admin"})
        on_profile = client.patch("/api/auth/me", json={"role": "admin"})
        with_fake_claims = client.get(
            "/api/admin/summary", headers={"X-Role": "admin", "X-User-Role": "admin"}
        )
        login_with_role = client.post(
            "/api/auth/login",
            json={"email": client.user.email, "password": client.user.password, "role": "admin"},
        )

        assert through_admin_api.status_code == 403
        assert become_admin.status_code == 403
        assert on_profile.status_code == 405
        assert with_fake_claims.status_code == 403
        assert login_with_role.json()["role"] == role
        with SessionLocal() as session:
            assert session.get(User, client.user.id).role == role


def test_admin_can_switch_an_account_between_user_and_researcher(
    lab, client_as, make_user
) -> None:
    admin = client_as("admin")
    person = make_user("user")
    person_client = TestClient(app)
    log_in(person_client, person)
    assert _open_lab(person_client).status_code == 403

    promoted = admin.patch(f"/api/admin/users/{person.id}/role", json={"role": "researcher"})

    assert promoted.status_code == 200
    assert promoted.json()["role"] == "researcher"
    assert "password" not in promoted.text
    # The account signs in again and then has its new permission.
    assert person_client.get("/api/auth/me").status_code == 401
    log_in(person_client, person)
    assert _open_lab(person_client).status_code == 201

    demoted = admin.patch(f"/api/admin/users/{person.id}/role", json={"role": "user"})
    assert demoted.json()["role"] == "user"
    with SessionLocal() as session:
        assert session.scalars(
            select(UserSession).where(UserSession.user_id == person.id)
        ).all() == []


def test_admin_accounts_cannot_be_made_or_removed_through_the_api(
    client_as, make_user
) -> None:
    admin = client_as("admin")
    other_admin = make_user("admin")
    person = make_user("user")

    make_admin = admin.patch(f"/api/admin/users/{person.id}/role", json={"role": "admin"})
    invalid_role = admin.patch(f"/api/admin/users/{person.id}/role", json={"role": "owner"})
    demote_other = admin.patch(f"/api/admin/users/{other_admin.id}/role", json={"role": "user"})
    demote_self = admin.patch(f"/api/admin/users/{admin.user.id}/role", json={"role": "user"})
    missing = admin.patch(
        "/api/admin/users/00000000-0000-0000-0000-000000000000/role", json={"role": "user"}
    )

    assert make_admin.status_code == 422
    assert invalid_role.status_code == 422
    assert demote_other.status_code == 409
    assert demote_self.status_code == 409
    assert missing.status_code == 404
    with SessionLocal() as session:
        assert session.get(User, person.id).role == "user"
        assert session.get(User, other_admin.id).role == "admin"
        assert session.get(User, admin.user.id).role == "admin"


def test_user_list_is_for_admins_and_has_no_password_data(client_as) -> None:
    admin = client_as("admin")

    response = admin.get("/api/admin/users")

    assert response.status_code == 200
    listed = next(item for item in response.json() if item["id"] == admin.user.id)
    assert set(listed) == {"id", "email", "display_name", "role", "is_active", "created_at"}
    assert "argon2" not in response.text
