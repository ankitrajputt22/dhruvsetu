from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.seed import DEMO_IDS, seed_demo_data

client = TestClient(app)


def _ensure_demo_data() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)


def test_search_returns_results_from_multiple_resources() -> None:
    _ensure_demo_data()

    response = client.get("/api/search", params={"q": "climate"})

    assert response.status_code == 200
    results = response.json()
    assert results
    assert {
        "expedition",
        "scientist",
        "publication",
        "topic",
        "report",
    }.issubset({result["type"] for result in results})
    assert any(result["match_reason"] == "Matched title" for result in results)
    assert any(result["is_demo_data"] for result in results)


def test_search_is_case_insensitive() -> None:
    _ensure_demo_data()

    lowercase = client.get("/api/search", params={"q": "climate"}).json()
    uppercase = client.get("/api/search", params={"q": "CLIMATE"}).json()

    assert {(item["type"], item["id"]) for item in lowercase} == {
        (item["type"], item["id"]) for item in uppercase
    }


def test_search_resource_type_filter() -> None:
    _ensure_demo_data()

    response = client.get(
        "/api/search", params={"q": "ice", "type": "dataset"}
    )

    assert response.status_code == 200
    results = response.json()
    assert results
    assert all(result["type"] == "dataset" for result in results)
    assert DEMO_IDS["datasets"]["sea-ice"] in {
        result["id"] for result in results
    }


def test_search_without_matches_returns_empty_list() -> None:
    _ensure_demo_data()

    response = client.get(
        "/api/search", params={"q": "no-such-polar-record-12345"}
    )

    assert response.status_code == 200
    assert response.json() == []


def test_empty_search_query_returns_validation_error() -> None:
    response = client.get("/api/search", params={"q": "   "})

    assert response.status_code == 422
    assert response.json() == {"detail": "Search query cannot be empty"}
