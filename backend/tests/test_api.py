from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.seed import DEMO_COUNTS, DEMO_IDS
from demo_data import seed_demo_data

client = TestClient(app)


def _ensure_demo_data() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)


def test_expedition_list_returns_mysql_data() -> None:
    _ensure_demo_data()

    response = client.get("/api/expeditions")

    assert response.status_code == 200
    expeditions = response.json()
    demo_ids = set(DEMO_IDS["expeditions"].values())
    demo_expeditions = [item for item in expeditions if item["id"] in demo_ids]
    assert len(demo_expeditions) == DEMO_COUNTS["expeditions"]
    assert all(item["is_demo_data"] for item in demo_expeditions)


def test_expedition_detail_returns_connected_data() -> None:
    _ensure_demo_data()
    expedition_id = DEMO_IDS["expeditions"]["climate"]

    response = client.get(f"/api/expeditions/{expedition_id}")

    assert response.status_code == 200
    expedition = response.json()
    assert expedition["id"] == expedition_id
    assert expedition["scientists"]
    assert expedition["research_topics"]
    assert expedition["locations"]
    assert expedition["publications"]
    assert expedition["reports"]
    assert expedition["datasets"]
    assert expedition["media_assets"]


def test_missing_expedition_returns_404() -> None:
    response = client.get("/api/expeditions/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    assert response.json() == {"detail": "Expedition not found"}


def test_dataset_list_returns_mysql_data() -> None:
    _ensure_demo_data()

    response = client.get("/api/datasets")

    assert response.status_code == 200
    datasets = response.json()
    demo_ids = set(DEMO_IDS["datasets"].values())
    demo_datasets = [item for item in datasets if item["id"] in demo_ids]
    assert len(demo_datasets) == DEMO_COUNTS["datasets"]
    assert all(item["is_demo_data"] for item in demo_datasets)


def test_remaining_read_only_endpoints() -> None:
    _ensure_demo_data()

    for path, expected_count in (
        ("/api/scientists", DEMO_COUNTS["scientists"]),
        ("/api/publications", DEMO_COUNTS["publications"]),
        ("/api/topics", DEMO_COUNTS["research_topics"]),
    ):
        response = client.get(path)
        assert response.status_code == 200
        assert len(response.json()) >= expected_count

    scientist_id = DEMO_IDS["scientists"]["alpha"]
    response = client.get(f"/api/scientists/{scientist_id}")
    assert response.status_code == 200
    assert response.json()["institution"]["name"].startswith("Demo")
