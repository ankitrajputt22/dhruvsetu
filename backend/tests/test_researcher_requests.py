from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import ResearcherAccessRequest, User, UserSession
from app.researcher import requests as request_logic
from conftest import TEST_PASSWORD, log_in

ACCESS_URL = "/api/researcher-access"
ADMIN_URL = "/api/admin/researcher-requests"

DETAILS = {
    "institution": "Test Polar Institute",
    "research_area": "Glaciology",
    "designation": "Research student",
    "reason": "To submit field notes and analyse datasets.",
    "profile_url": "https://example.org/people/test-person",
    "acknowledged": True,
}


def _ask(client: TestClient, **changes):
    return client.post(ACCESS_URL, json={**DETAILS, **changes})


def _request_id(client: TestClient) -> str:
    return client.get(ACCESS_URL).json()["requests"][0]["id"]


def _stored(request_id: str) -> ResearcherAccessRequest:
    with SessionLocal() as session:
        return session.get(ResearcherAccessRequest, request_id)


def _role(user_id: str) -> str:
    with SessionLocal() as session:
        return session.get(User, user_id).role


def _session_count(user_id: str) -> int:
    with SessionLocal() as session:
        return len(
            session.scalars(select(UserSession).where(UserSession.user_id == user_id)).all()
        )


def test_a_general_user_can_ask_for_researcher_access(client_as) -> None:
    client = client_as("user")
    before = client.get(ACCESS_URL).json()

    response = _ask(client)

    assert before == {
        "role": "user",
        "access_status": "none",
        "can_request": True,
        "requests": [],
    }
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "user"
    assert body["access_status"] == "pending"
    assert body["can_request"] is False
    (saved,) = body["requests"]
    assert saved["status"] == "pending"
    assert saved["institution"] == "Test Polar Institute"
    assert saved["decided_at"] is None and saved["decision_note"] is None
    # The applicant is never told which admin decides.
    assert "decided_by" not in saved and "decided_by_user_id" not in saved
    # A request is not a role.
    assert _role(client.user.id) == "user"
    assert set(client.get("/api/auth/me").json()) == {"id", "email", "display_name", "role"}


def test_status_needs_a_login() -> None:
    anonymous = TestClient(app)

    assert anonymous.get(ACCESS_URL).status_code == 401
    assert _ask(anonymous).status_code == 401


def test_only_one_request_can_wait_at_a_time(client_as) -> None:
    client = client_as("user")
    assert _ask(client).status_code == 201

    again = _ask(client, institution="Another Institute")

    assert again.status_code == 409
    assert again.json() == {"detail": "You already have a request waiting for review."}
    assert len(client.get(ACCESS_URL).json()["requests"]) == 1


def test_a_waiting_request_gives_no_researcher_permissions(client_as) -> None:
    client = client_as("user")
    assert _ask(client).status_code == 201

    assert client.get("/api/researcher/submissions").status_code == 403
    assert client.post("/api/researcher/documents").status_code == 403
    assert client.post("/api/researcher/datasets").status_code == 403
    assert client.post("/api/data-lab/sessions", json={"dataset_id": "any"}).status_code == 403
    assert client.get(ADMIN_URL).status_code == 403


@pytest.mark.parametrize(
    "extra",
    [
        {"status": "approved"},
        {"role": "researcher"},
        {"approved": True},
        {"decided_by": "someone"},
        {"decided_by_user_id": "someone"},
        {"decided_at": "2026-01-01T00:00:00"},
        {"decision_note": "Approved by myself."},
        {"user_id": "another-account"},
    ],
)
def test_a_request_cannot_carry_a_decision_or_a_role(client_as, extra) -> None:
    client = client_as("user")

    response = _ask(client, **extra)

    assert response.status_code == 422
    assert client.get(ACCESS_URL).json()["requests"] == []
    assert _role(client.user.id) == "user"


def test_signup_with_researcher_intent_starts_a_pending_request() -> None:
    email = f"test-signup-{uuid4().hex[:12]}@dhruvsetu.test"
    client = TestClient(app)
    try:
        created = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "display_name": "Signup Researcher",
                "account_type": "researcher",
                "researcher": {**DETAILS, "status": "approved"},
            },
        )
        assert created.status_code == 422

        created = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "display_name": "Signup Researcher",
                "account_type": "researcher",
                "researcher": DETAILS,
            },
        )
        assert created.status_code == 201
        assert created.json()["role"] == "user"
        access = client.get(ACCESS_URL).json()
        assert access["access_status"] == "pending"
        assert access["requests"][0]["status"] == "pending"
    finally:
        with SessionLocal() as session:
            user = session.scalar(select(User).where(User.email == email))
            if user is not None:
                session.delete(user)
                session.commit()


@pytest.mark.parametrize("role", ["user", "researcher"])
def test_only_admins_can_see_or_decide_requests(client_as, role) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    other = client_as(role)

    assert other.get(ADMIN_URL).status_code == 403
    assert other.get(f"{ADMIN_URL}/{request_id}").status_code == 403
    assert other.post(f"{ADMIN_URL}/{request_id}/approve", json={}).status_code == 403
    assert other.post(f"{ADMIN_URL}/{request_id}/reject", json={}).status_code == 403
    # The applicant cannot approve their own request either.
    assert applicant.post(f"{ADMIN_URL}/{request_id}/approve", json={}).status_code == 403
    anonymous = TestClient(app)
    assert anonymous.get(ADMIN_URL).status_code == 401
    assert anonymous.post(f"{ADMIN_URL}/{request_id}/approve", json={}).status_code == 401
    assert _stored(request_id).status == "pending"
    assert _role(applicant.user.id) == "user"


def test_admin_can_list_and_read_requests(client_as) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    admin = client_as("admin")

    pending = admin.get(ADMIN_URL)
    by_status = {
        name: [item["id"] for item in admin.get(f"{ADMIN_URL}?status={name}").json()]
        for name in ("pending", "approved", "rejected", "all")
    }
    detail = admin.get(f"{ADMIN_URL}/{request_id}")

    assert pending.status_code == 200
    (listed,) = [item for item in pending.json() if item["id"] == request_id]
    assert listed["status"] == "pending"
    assert listed["applicant"] == {
        "id": applicant.user.id,
        "email": applicant.user.email,
        "display_name": "Test User",
        "role": "user",
    }
    assert listed["institution"] == "Test Polar Institute"
    assert request_id in by_status["pending"] and request_id in by_status["all"]
    assert request_id not in by_status["approved"] + by_status["rejected"]
    assert admin.get(f"{ADMIN_URL}?status=granted").status_code == 422

    assert detail.status_code == 200
    body = detail.json()
    assert body["reason"] == DETAILS["reason"]
    assert body["profile_url"] == DETAILS["profile_url"]
    assert body["designation"] == "Research student"
    assert body["decided_by"] is None and body["decided_at"] is None
    assert body["other_requests"] == []
    assert "password" not in detail.text
    assert admin.get(f"{ADMIN_URL}/not-a-request").status_code == 404


def test_approval_makes_the_account_a_researcher_and_ends_its_sessions(client_as) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    second_device = TestClient(app)
    assert log_in(second_device, applicant.user).status_code == 200
    admin = client_as("admin")

    response = admin.post(f"{ADMIN_URL}/{request_id}/approve", json={"note": " Welcome. "})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["applicant"]["role"] == "researcher"
    assert body["decided_by"] == "Test Admin"
    assert body["decided_at"] is not None
    assert body["decision_note"] == "Welcome."

    saved = _stored(request_id)
    assert saved.status == "approved"
    assert saved.decided_by_user_id == admin.user.id
    assert saved.decided_at is not None
    assert _role(applicant.user.id) == "researcher"

    # Every session the person had is gone. They sign in again as a researcher.
    assert _session_count(applicant.user.id) == 0
    assert applicant.get("/api/auth/me").status_code == 401
    assert second_device.get("/api/auth/me").status_code == 401
    assert log_in(applicant, applicant.user).json()["role"] == "researcher"
    assert applicant.get("/api/researcher/submissions").status_code == 200
    access = applicant.get(ACCESS_URL).json()
    assert access["access_status"] == "approved"
    assert access["can_request"] is False
    assert access["requests"][0]["decision_note"] == "Welcome."
    # The admin keeps their own session.
    assert admin.get("/api/auth/me").status_code == 200


def test_rejection_keeps_the_account_a_normal_user(client_as) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    admin = client_as("admin")

    response = admin.post(
        f"{ADMIN_URL}/{request_id}/reject",
        json={"note": "Please add your institutional profile."},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert response.json()["applicant"]["role"] == "user"
    saved = _stored(request_id)
    assert saved.status == "rejected"
    assert saved.decided_by_user_id == admin.user.id
    assert saved.decided_at is not None
    assert _role(applicant.user.id) == "user"
    with SessionLocal() as session:
        assert session.get(User, applicant.user.id).is_active is True

    # The person stays signed in, sees the outcome and the note, and nothing more.
    access = applicant.get(ACCESS_URL)
    assert access.status_code == 200
    body = access.json()
    assert body["access_status"] == "rejected"
    assert body["requests"][0]["decision_note"] == "Please add your institutional profile."
    assert "Test Admin" not in access.text and admin.user.email not in access.text
    assert applicant.get("/api/researcher/submissions").status_code == 403


def test_a_decision_is_made_once(client_as) -> None:
    approved = client_as("user")
    rejected = client_as("user")
    assert _ask(approved).status_code == 201 and _ask(rejected).status_code == 201
    approved_id, rejected_id = _request_id(approved), _request_id(rejected)
    admin = client_as("admin")
    assert admin.post(f"{ADMIN_URL}/{approved_id}/approve", json={}).status_code == 200
    assert admin.post(f"{ADMIN_URL}/{rejected_id}/reject", json={}).status_code == 200

    repeats = {
        "approve approved": admin.post(f"{ADMIN_URL}/{approved_id}/approve", json={}),
        "reject approved": admin.post(f"{ADMIN_URL}/{approved_id}/reject", json={}),
        "reject rejected": admin.post(f"{ADMIN_URL}/{rejected_id}/reject", json={}),
        "approve rejected": admin.post(f"{ADMIN_URL}/{rejected_id}/approve", json={}),
    }

    assert {name: reply.status_code for name, reply in repeats.items()} == dict.fromkeys(
        repeats, 409
    )
    assert repeats["reject approved"].json() == {
        "detail": "This request was already approved."
    }
    assert _stored(approved_id).status == "approved"
    assert _stored(rejected_id).status == "rejected"
    assert _role(approved.user.id) == "researcher"
    assert _role(rejected.user.id) == "user"
    assert admin.post(f"{ADMIN_URL}/not-a-request/approve", json={}).status_code == 404
    assert admin.post(f"{ADMIN_URL}/{rejected_id}/approve", json={"role": "admin"}).status_code == 422


def test_an_admin_cannot_decide_their_own_request(client_as) -> None:
    person = client_as("user")
    assert _ask(person).status_code == 201
    request_id = _request_id(person)
    with SessionLocal() as session:
        session.get(User, person.user.id).role = "admin"
        session.commit()

    response = person.post(f"{ADMIN_URL}/{request_id}/approve", json={})

    assert response.status_code == 403
    assert response.json() == {"detail": "You cannot decide your own request."}
    assert _stored(request_id).status == "pending"


def test_a_rejected_person_can_ask_again_and_the_history_is_kept(client_as) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    first_id = _request_id(applicant)
    admin = client_as("admin")
    admin.post(f"{ADMIN_URL}/{first_id}/reject", json={"note": "Not enough detail."})
    assert applicant.get(ACCESS_URL).json()["can_request"] is True

    second = _ask(applicant, reason="A fuller reason with the project described.")

    assert second.status_code == 201
    newest, oldest = second.json()["requests"]
    assert newest["status"] == "pending" and newest["id"] != first_id
    assert oldest["id"] == first_id and oldest["status"] == "rejected"
    assert oldest["decision_note"] == "Not enough detail."
    assert second.json()["access_status"] == "pending"

    # The admin sees the earlier decision next to the new request.
    detail = admin.get(f"{ADMIN_URL}/{newest['id']}").json()
    (earlier,) = detail["other_requests"]
    assert earlier["id"] == first_id
    assert earlier["status"] == "rejected"
    assert earlier["decided_by"] == "Test Admin"
    assert earlier["decision_note"] == "Not enough detail."

    assert admin.post(f"{ADMIN_URL}/{newest['id']}/approve", json={}).status_code == 200
    assert _stored(first_id).status == "rejected"
    assert _role(applicant.user.id) == "researcher"


@pytest.mark.parametrize("role", ["researcher", "admin"])
def test_an_account_with_access_needs_no_request(client_as, role) -> None:
    client = client_as(role)

    access = client.get(ACCESS_URL).json()
    response = _ask(client)

    assert access["access_status"] == "approved"
    assert access["can_request"] is False
    assert response.status_code == 409
    assert response.json() == {"detail": "Your account already has researcher access."}


def test_giving_the_role_on_the_users_page_settles_a_waiting_request(client_as) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    admin = client_as("admin")

    promoted = admin.patch(
        f"/api/admin/users/{applicant.user.id}/role", json={"role": "researcher"}
    )

    assert promoted.status_code == 200
    saved = _stored(request_id)
    assert saved.status == "approved"
    assert saved.decided_by_user_id == admin.user.id
    assert saved.decision_note == request_logic.MANUAL_PROMOTION_NOTE
    # The account is never a researcher while its request still says pending.
    still_pending = [item["id"] for item in admin.get(f"{ADMIN_URL}?status=pending").json()]
    assert request_id not in still_pending
    assert _role(applicant.user.id) == "researcher"
    assert _session_count(applicant.user.id) == 0


def test_removing_the_role_keeps_the_request_history(client_as) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    admin = client_as("admin")
    assert admin.post(f"{ADMIN_URL}/{request_id}/approve", json={}).status_code == 200

    demoted = admin.patch(
        f"/api/admin/users/{applicant.user.id}/role", json={"role": "user"}
    )

    assert demoted.status_code == 200
    assert _stored(request_id).status == "approved"
    assert log_in(applicant, applicant.user).json()["role"] == "user"
    assert applicant.get("/api/researcher/submissions").status_code == 403
    access = applicant.get(ACCESS_URL).json()
    # The earlier approval stays on record, but it no longer counts as access.
    assert access["access_status"] == "removed"
    assert access["can_request"] is True
    assert _ask(applicant).status_code == 201


def test_approval_is_all_or_nothing(client_as, monkeypatch) -> None:
    applicant = client_as("user")
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    admin = client_as("admin")
    failing = TestClient(app, raise_server_exceptions=False)
    failing.cookies = admin.cookies

    def fail(*args, **kwargs):
        raise RuntimeError("stopped half way")

    monkeypatch.setattr(request_logic, "end_all_sessions_for", fail)

    response = failing.post(f"{ADMIN_URL}/{request_id}/approve", json={})

    assert response.status_code == 500
    # Nothing was saved: not the status, not the role.
    assert _stored(request_id).status == "pending"
    assert _stored(request_id).decided_by_user_id is None
    assert _role(applicant.user.id) == "user"
    assert applicant.get("/api/auth/me").status_code == 200


def test_new_endpoints_refuse_requests_from_other_sites(client_as) -> None:
    other_site = {"Origin": "https://example.com"}
    applicant = client_as("user")
    admin = client_as("admin")

    asked = applicant.post(ACCESS_URL, json=DETAILS, headers=other_site)
    assert asked.status_code == 403
    assert _ask(applicant).status_code == 201
    request_id = _request_id(applicant)
    decided = admin.post(f"{ADMIN_URL}/{request_id}/approve", json={}, headers=other_site)

    assert decided.status_code == 403
    assert _stored(request_id).status == "pending"
    researcher = client_as("researcher")
    upload = researcher.post(
        "/api/researcher/documents",
        data={"title": "Blocked", "document_type": "report"},
        files={"file": ("notes.txt", b"Text from another site.", "text/plain")},
        headers=other_site,
    )
    assert upload.status_code == 403
