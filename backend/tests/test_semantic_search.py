import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import api as api_module
from app.database import SessionLocal
from app.main import app
from app.schemas import SearchResourceType
from app.search import semantic
from app.search.semantic import (
    DOCUMENT_CHUNK_TYPE,
    SearchDocument,
    SemanticMatch,
    SemanticSearchUnavailable,
)
from app.seed import DEMO_IDS
from demo_data import seed_demo_data

client = TestClient(app)


def _ensure_demo_data() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)


def test_semantic_search_returns_mysql_record(monkeypatch) -> None:
    _ensure_demo_data()

    def fake_search(query, *, resource_type=None):
        assert query == "polar weather research"
        assert resource_type is None
        return [
            SemanticMatch(
                resource_type=SearchResourceType.expedition,
                record_id=DEMO_IDS["expeditions"]["climate"],
                score=0.8,
            )
        ]

    monkeypatch.setattr(api_module, "search_semantic_index", fake_search)

    response = client.get(
        "/api/search",
        params={"q": "polar weather research", "mode": "semantic"},
    )

    assert response.status_code == 200
    assert response.json()[0]["type"] == "expedition"
    assert response.json()[0]["search_mode"] == "semantic"
    assert response.json()[0]["match_reason"] == "Related to your search"


def test_semantic_search_resource_filter(monkeypatch) -> None:
    _ensure_demo_data()

    def fake_search(query, *, resource_type=None):
        assert query == "ice temperature data"
        assert resource_type == SearchResourceType.dataset
        return [
            SemanticMatch(
                resource_type=SearchResourceType.dataset,
                record_id=DEMO_IDS["datasets"]["temperature"],
                score=0.7,
            )
        ]

    monkeypatch.setattr(api_module, "search_semantic_index", fake_search)

    response = client.get(
        "/api/search",
        params={
            "q": "ice temperature data",
            "mode": "semantic",
            "type": "dataset",
        },
    )

    assert response.status_code == 200
    assert {item["type"] for item in response.json()} == {"dataset"}


def test_semantic_search_does_not_change_keyword_search() -> None:
    _ensure_demo_data()

    response = client.get(
        "/api/search",
        params={"q": "climate", "mode": "keyword"},
    )

    assert response.status_code == 200
    assert response.json()
    assert all(item["search_mode"] == "keyword" for item in response.json())


def test_missing_semantic_index_is_handled(monkeypatch) -> None:
    def unavailable(query, *, resource_type=None):
        raise SemanticSearchUnavailable("Index not built")

    monkeypatch.setattr(api_module, "search_semantic_index", unavailable)

    response = client.get(
        "/api/search",
        params={"q": "polar weather", "mode": "semantic"},
    )

    assert response.status_code == 503
    assert response.json() == {
        "detail": (
            "Semantic search is not ready right now. "
            "You can still use keyword search."
        )
    }


def test_empty_semantic_query_returns_validation_error(monkeypatch) -> None:
    def should_not_run(query, *, resource_type=None):
        pytest.fail("Semantic search should not run for an empty query")

    monkeypatch.setattr(api_module, "search_semantic_index", should_not_run)

    response = client.get(
        "/api/search",
        params={"q": "   ", "mode": "semantic"},
    )

    assert response.status_code == 422


def test_index_rebuild_and_vector_filter(tmp_path, monkeypatch) -> None:
    documents = [
        SearchDocument(
            resource_type=SearchResourceType.expedition,
            record_id="expedition-id",
            text="expedition: Antarctic climate research",
        ),
        SearchDocument(
            resource_type=SearchResourceType.dataset,
            record_id="dataset-id",
            text="dataset: Sea ice temperature data",
        ),
    ]

    monkeypatch.setattr(semantic, "collect_search_documents", lambda db: documents)

    def fake_encode(texts):
        return np.asarray(
            [
                [0.0, 1.0]
                if "ice" in text.casefold()
                else [1.0, 0.0]
                for text in texts
            ],
            dtype=np.float32,
        )

    monkeypatch.setattr(semantic, "_encode", fake_encode)

    first_count = semantic.build_semantic_index(None, index_dir=tmp_path)
    second_count = semantic.build_semantic_index(None, index_dir=tmp_path)
    matches = semantic.search_semantic_index(
        "ice data",
        resource_type=SearchResourceType.dataset,
        index_dir=tmp_path,
    )

    assert first_count == 2
    assert second_count == 2
    assert [match.record_id for match in matches] == ["dataset-id"]


def test_document_chunks_are_indexed_but_hidden_from_normal_search(
    tmp_path, monkeypatch
) -> None:
    documents = [
        SearchDocument(
            resource_type=SearchResourceType.expedition,
            record_id="expedition-id",
            text="expedition: Antarctic climate research",
        ),
        SearchDocument(
            resource_type=DOCUMENT_CHUNK_TYPE,
            record_id="chunk-id",
            document_id="document-id",
            page_number=4,
            text="document: Antarctic climate source details",
        ),
    ]
    monkeypatch.setattr(semantic, "collect_search_documents", lambda db: documents)
    monkeypatch.setattr(
        semantic,
        "_encode",
        lambda texts: np.asarray([[1.0, 0.0] for _ in texts], dtype=np.float32),
    )

    assert semantic.build_semantic_index(None, index_dir=tmp_path) == 2
    normal_matches = semantic.search_semantic_index("climate", index_dir=tmp_path)
    chunk_matches = semantic.search_semantic_index(
        "climate",
        resource_type=DOCUMENT_CHUNK_TYPE,
        index_dir=tmp_path,
    )

    assert [match.record_id for match in normal_matches] == ["expedition-id"]
    assert [match.record_id for match in chunk_matches] == ["chunk-id"]
    assert chunk_matches[0].document_id == "document-id"
    assert chunk_matches[0].page_number == 4
