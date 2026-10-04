import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.ingestion.seed_demo import seed_demo_documents
from app.main import app
from app.models import Dataset, ResearchStation, VerificationChange
from app.seed import STATION_IDS, seed_station_locations


@pytest.fixture
def dataset_id():
    """A temporary demo dataset to move through the verification steps."""
    seed_demo_documents()
    with SessionLocal() as session:
        dataset = Dataset(
            title="Test dataset for verification checks",
            description="Temporary test record.",
            is_demo_data=True,
            source_url="https://example.org/data/verification-test",
        )
        session.add(dataset)
        session.commit()
        record_id = dataset.id
    try:
        yield record_id
    finally:
        with SessionLocal() as session:
            session.execute(
                delete(VerificationChange).where(VerificationChange.record_id == record_id)
            )
            session.execute(delete(Dataset).where(Dataset.id == record_id))
            session.commit()


def _set_status(client: TestClient, dataset_id: str, status: str):
    return client.patch(
        f"/api/admin/records/dataset/{dataset_id}/verification",
        json={"status": status},
    )


def _public_status(dataset_id: str) -> str:
    return TestClient(app).get(f"/api/datasets/{dataset_id}").json()["verification_status"]


def test_summary_counts_every_record_type_with_a_status(client_as, dataset_id) -> None:
    response = client_as("admin").get("/api/admin/summary")

    assert response.status_code == 200
    rows = {row["record_type"]: row for row in response.json()}
    assert set(rows) == {
        "expedition",
        "publication",
        "report",
        "dataset",
        "document",
        "station",
        "media",
    }
    assert set(rows["dataset"]) == {"record_type", "type_label", "uploaded", "reviewed", "verified"}
    assert rows["dataset"]["uploaded"] >= 1
    assert rows["station"]["type_label"] == "Research station"


def test_queue_lists_uploaded_records_first(client_as, dataset_id) -> None:
    admin = client_as("admin")

    default = admin.get("/api/admin/records")
    datasets = admin.get("/api/admin/records", params={"status": "uploaded", "type": "dataset"})
    verified = admin.get("/api/admin/records", params={"status": "verified", "type": "dataset"})

    assert default.status_code == 200
    assert {item["verification_status"] for item in default.json()} == {"uploaded"}
    record = next(item for item in datasets.json() if item["id"] == dataset_id)
    assert record == {
        "record_type": "dataset",
        "type_label": "Dataset",
        "id": dataset_id,
        "title": "Test dataset for verification checks",
        "verification_status": "uploaded",
        "is_demo_data": True,
        "source_url": "https://example.org/data/verification-test",
        "created_at": record["created_at"],
    }
    assert record["created_at"]
    assert {item["record_type"] for item in datasets.json()} == {"dataset"}
    assert dataset_id not in {item["id"] for item in verified.json()}
    assert admin.get("/api/admin/records", params={"status": "approved"}).status_code == 422
    assert admin.get("/api/admin/records", params={"type": "scientist"}).status_code == 422


def test_review_shows_the_source_information(client_as, dataset_id) -> None:
    response = client_as("admin").get(f"/api/admin/records/dataset/{dataset_id}")

    assert response.status_code == 200
    detail = response.json()
    assert detail["title"] == "Test dataset for verification checks"
    assert detail["description"] == "Temporary test record."
    assert detail["source_url"] == "https://example.org/data/verification-test"
    assert detail["is_demo_data"] is True
    assert detail["href"] == f"/datasets/{dataset_id}"
    assert {"label": "Data file", "value": "Metadata only, no data file"} in detail["facts"]
    assert detail["related_resources"] == []
    assert detail["changes"] == []


def test_admin_moves_a_record_through_reviewed_to_verified(client_as, dataset_id) -> None:
    admin = client_as("admin")

    reviewed = _set_status(admin, dataset_id, "reviewed")
    assert reviewed.status_code == 200
    assert reviewed.json()["verification_status"] == "reviewed"
    # The public page reads the same value, so its badge changes too.
    assert _public_status(dataset_id) == "reviewed"

    verified = _set_status(admin, dataset_id, "verified")
    assert verified.status_code == 200
    assert _public_status(dataset_id) == "verified"

    # Who changed what is kept with the record.
    changes = verified.json()["changes"]
    assert [(item["from_status"], item["to_status"]) for item in changes] in (
        [("reviewed", "verified"), ("uploaded", "reviewed")],
        [("uploaded", "reviewed"), ("reviewed", "verified")],
    )
    assert {item["changed_by"] for item in changes} == {"Test Admin"}
    assert all(item["changed_at"] for item in changes)
    # Verification never changes the demo label.
    assert verified.json()["is_demo_data"] is True
    assert TestClient(app).get(f"/api/datasets/{dataset_id}").json()["is_demo_data"] is True


def test_a_record_cannot_skip_review_but_can_be_moved_back(client_as, dataset_id) -> None:
    admin = client_as("admin")

    skipped = _set_status(admin, dataset_id, "verified")
    same = _set_status(admin, dataset_id, "uploaded")

    assert skipped.status_code == 409
    assert skipped.json() == {
        "detail": "A record must be Reviewed before it can be Verified."
    }
    assert same.status_code == 409
    assert _public_status(dataset_id) == "uploaded"

    _set_status(admin, dataset_id, "reviewed")
    _set_status(admin, dataset_id, "verified")
    back = _set_status(admin, dataset_id, "uploaded")

    assert back.status_code == 200
    assert _public_status(dataset_id) == "uploaded"


def test_only_admins_can_change_a_status(client_as, dataset_id) -> None:
    anonymous = _set_status(TestClient(app), dataset_id, "reviewed")
    user = _set_status(client_as("user"), dataset_id, "reviewed")
    researcher = _set_status(client_as("researcher"), dataset_id, "reviewed")
    detail_as_user = client_as("user").get(f"/api/admin/records/dataset/{dataset_id}")

    assert anonymous.status_code == 401
    assert user.status_code == 403
    assert researcher.status_code == 403
    assert detail_as_user.status_code == 403
    assert _public_status(dataset_id) == "uploaded"
    with SessionLocal() as session:
        assert session.query(VerificationChange).filter_by(record_id=dataset_id).count() == 0


def test_invalid_status_type_or_record_is_rejected(client_as, dataset_id) -> None:
    admin = client_as("admin")

    bad_status = _set_status(admin, dataset_id, "approved")
    no_status = admin.patch(f"/api/admin/records/dataset/{dataset_id}/verification", json={})
    bad_type = admin.patch(
        f"/api/admin/records/scientist/{dataset_id}/verification", json={"status": "reviewed"}
    )
    missing = _set_status(admin, "00000000-0000-0000-0000-000000000000", "reviewed")
    wrong_type = admin.patch(
        f"/api/admin/records/expedition/{dataset_id}/verification", json={"status": "reviewed"}
    )

    assert bad_status.status_code == 422
    assert no_status.status_code == 422
    assert bad_type.status_code == 422
    assert missing.status_code == 404
    assert wrong_type.status_code == 404
    assert _public_status(dataset_id) == "uploaded"


def test_status_changes_from_another_site_are_refused(client_as, dataset_id) -> None:
    admin = client_as("admin")

    response = admin.patch(
        f"/api/admin/records/dataset/{dataset_id}/verification",
        json={"status": "reviewed"},
        headers={"Origin": "https://example.com"},
    )

    assert response.status_code == 403
    assert _public_status(dataset_id) == "uploaded"


def test_real_stations_wait_in_the_queue_with_their_source_note(client_as) -> None:
    with SessionLocal() as session:
        seed_station_locations(session)
        statuses = {
            key: session.get(ResearchStation, station_id).verification_status
            for key, station_id in STATION_IDS["research_stations"].items()
        }
    admin = client_as("admin")
    bharati = STATION_IDS["research_stations"]["bharati"]

    queue = admin.get("/api/admin/records", params={"status": "uploaded", "type": "station"})
    detail = admin.get(f"/api/admin/records/station/{bharati}").json()

    # Nothing marks the stations as checked on its own.
    assert statuses == {"bharati": "uploaded", "maitri": "uploaded", "himadri": "uploaded"}
    assert set(STATION_IDS["research_stations"].values()) <= {item["id"] for item in queue.json()}
    assert detail["title"] == "Bharati"
    assert detail["is_demo_data"] is False
    assert detail["source_url"] is None
    facts = {fact["label"]: fact["value"] for fact in detail["facts"]}
    assert facts["Location"] == "Bharati Station"
    assert facts["Stored coordinates"] == "-69.406833, 76.195333"
    assert "NCPOR Bharati station page" in facts["Location note"]
    assert detail["href"] == f"/map?location={STATION_IDS['locations']['bharati']}"
