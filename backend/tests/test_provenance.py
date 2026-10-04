from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.ingestion.retrieval import retrieve_source_chunks
from demo_data import seed_demo_documents
from app.ingestion.service import DocumentIngestionError, ingest_document
from app.main import app
from app.models import VERIFICATION_STATUSES, DocumentChunk
from app.search.semantic import DOCUMENT_CHUNK_TYPE, SemanticMatch
from app.seed import DEMO_IDS
from test_document_ingestion import (
    _delete_test_document,
    _file_hash,
    _write_text_pdf,
)

client = TestClient(app)

SOURCE_URL = "https://example.org/reports/provenance-test.pdf"
SEA_ICE_EXPEDITION_ID = DEMO_IDS["expeditions"]["sea-ice"]


@pytest.fixture
def reviewed_pdf(tmp_path):
    """A two-page test PDF with every optional provenance field filled in."""
    seed_demo_documents()
    source = tmp_path / "provenance.pdf"
    _write_text_pdf(
        source,
        [
            "Provenance test page one about glacier records.",
            "Provenance test page two about sea ice notes.",
        ],
    )
    digest = _file_hash(source)
    _delete_test_document(digest)
    try:
        with SessionLocal() as session:
            result = ingest_document(
                session,
                source,
                title="Test provenance PDF source",
                source_type="research_report",
                source_url=SOURCE_URL,
                publication_date=date(2024, 3, 15),
                verification_status="reviewed",
                is_demo_data=True,
                expedition_id=SEA_ICE_EXPEDITION_ID,
                document_store=tmp_path / "stored",
            )
            yield result.document.id
    finally:
        _delete_test_document(digest)


def _demo_document(title: str) -> dict:
    seed_demo_documents()
    response = client.get("/api/documents")
    assert response.status_code == 200
    return next(item for item in response.json() if item["title"] == title)


def test_verification_statuses_are_uploaded_reviewed_verified() -> None:
    assert VERIFICATION_STATUSES == ("uploaded", "reviewed", "verified")


def test_document_list_shows_provenance_and_related_records() -> None:
    sea_ice = _demo_document("Demo Sea Ice Observation Notes")
    biodiversity = _demo_document("Prototype Polar Biodiversity Field Guide Notes")
    climate = _demo_document("Demo Antarctic Climate Field Notes")

    assert sea_ice["file_type"] == "txt"
    assert sea_ice["source_type"] == "prototype"
    assert sea_ice["verification_status"] == "uploaded"
    assert sea_ice["is_demo_data"] is True
    assert sea_ice["related_resources"] == [
        {
            "id": SEA_ICE_EXPEDITION_ID,
            "type": "expedition",
            "title": "Demo Sea Ice Observation Expedition",
            "href": f"/expeditions/{SEA_ICE_EXPEDITION_ID}",
        }
    ]

    publication_id = DEMO_IDS["publications"]["biodiversity"]
    assert biodiversity["related_resources"] == [
        {
            "id": publication_id,
            "type": "publication",
            "title": "Demo Polar Biodiversity Field Guide",
            "href": f"/publications#publication-{publication_id}",
        }
    ]

    # Reports have no page of their own, so no link is offered.
    assert [item["type"] for item in climate["related_resources"]] == ["report"]
    assert climate["related_resources"][0]["href"] is None


def test_document_detail_returns_full_provenance(reviewed_pdf) -> None:
    response = client.get(f"/api/documents/{reviewed_pdf}")

    assert response.status_code == 200
    document = response.json()
    assert document["title"] == "Test provenance PDF source"
    assert document["file_type"] == "pdf"
    assert document["source_type"] == "research_report"
    assert document["source_url"] == SOURCE_URL
    assert document["publication_date"] == "2024-03-15"
    assert document["verification_status"] == "reviewed"
    assert document["is_demo_data"] is True
    assert document["chunk_count"] == 2
    assert document["first_page"] == 1
    assert document["last_page"] == 2
    assert document["created_at"]
    assert document["related_resources"] == [
        {
            "id": SEA_ICE_EXPEDITION_ID,
            "type": "expedition",
            "title": "Demo Sea Ice Observation Expedition",
            "href": f"/expeditions/{SEA_ICE_EXPEDITION_ID}",
        }
    ]


def test_document_detail_handles_missing_optional_metadata() -> None:
    document_id = _demo_document("Demo Antarctic Climate Field Notes")["id"]

    response = client.get(f"/api/documents/{document_id}")

    assert response.status_code == 200
    document = response.json()
    assert document["source_url"] is None
    assert document["publication_date"] is None
    assert document["first_page"] is None
    assert document["last_page"] is None
    assert document["verification_status"] == "uploaded"
    assert document["is_demo_data"] is True
    for hidden in ("file_path", "file_hash", "chunks", "text"):
        assert hidden not in document


def test_retrieval_preserves_page_number_and_source_details(
    reviewed_pdf, monkeypatch
) -> None:
    with SessionLocal() as session:
        chunk = session.scalar(
            select(DocumentChunk).where(
                DocumentChunk.document_id == reviewed_pdf,
                DocumentChunk.page_number == 2,
            )
        )
        assert chunk is not None

        def fake_search(query, *, resource_type=None, limit=10):
            return [
                SemanticMatch(
                    resource_type=DOCUMENT_CHUNK_TYPE,
                    record_id=chunk.id,
                    document_id=chunk.document_id,
                    page_number=chunk.page_number,
                    score=0.8,
                )
            ]

        monkeypatch.setattr(
            "app.ingestion.retrieval.search_semantic_index", fake_search
        )
        results = retrieve_source_chunks(session, "sea ice notes", limit=3)

    assert len(results) == 1
    source = results[0]
    assert source.page_number == 2
    assert source.document_title == "Test provenance PDF source"
    assert source.file_type == "pdf"
    assert source.source_type == "research_report"
    assert source.source_url == SOURCE_URL
    assert source.publication_date == date(2024, 3, 15)
    assert source.verification_status == "reviewed"
    assert source.is_demo_data is True
    assert [(item.type, item.id) for item in source.related_resources] == [
        ("expedition", SEA_ICE_EXPEDITION_ID)
    ]


def test_ingestion_does_not_verify_documents_by_default(tmp_path) -> None:
    source = tmp_path / "default-status.txt"
    source.write_text("Default status provenance test notes. " * 10, encoding="utf-8")
    digest = _file_hash(source)
    _delete_test_document(digest)
    try:
        with SessionLocal() as session:
            result = ingest_document(
                session,
                source,
                is_demo_data=True,
                document_store=tmp_path / "stored",
            )
            assert result.document.verification_status == "uploaded"
    finally:
        _delete_test_document(digest)


def test_ingestion_rejects_unknown_verification_status(tmp_path) -> None:
    source = tmp_path / "status.txt"
    source.write_text("Verification status test notes.", encoding="utf-8")

    with SessionLocal() as session:
        with pytest.raises(DocumentIngestionError, match="uploaded, reviewed or verified"):
            ingest_document(session, source, verification_status="approved")


@pytest.mark.parametrize(
    "source_url",
    ["javascript:alert(1)", "data:text/html,<p>x</p>", "example.org/report.pdf"],
)
def test_ingestion_rejects_source_urls_that_are_not_web_links(
    tmp_path, source_url
) -> None:
    source = tmp_path / "url.txt"
    source.write_text("Source URL test notes.", encoding="utf-8")

    with SessionLocal() as session:
        with pytest.raises(DocumentIngestionError, match="Source URL must start"):
            ingest_document(session, source, source_url=source_url)


def test_expedition_detail_lists_connected_source_documents() -> None:
    seed_demo_documents()

    sea_ice = client.get(f"/api/expeditions/{SEA_ICE_EXPEDITION_ID}").json()
    climate = client.get(
        f"/api/expeditions/{DEMO_IDS['expeditions']['climate']}"
    ).json()

    direct = next(
        item
        for item in sea_ice["source_documents"]
        if item["title"] == "Demo Sea Ice Observation Notes"
    )
    assert direct["verification_status"] == "uploaded"
    assert direct["is_demo_data"] is True
    assert direct["source_url"] is None

    # Linked through the expedition's report rather than directly.
    through_report = next(
        item
        for item in climate["source_documents"]
        if item["title"] == "Demo Antarctic Climate Field Notes"
    )
    assert [item["type"] for item in through_report["related_resources"]] == ["report"]

    for section in ("publications", "reports", "datasets"):
        for record in sea_ice[section]:
            assert record["verification_status"] == "uploaded"
            assert record["is_demo_data"] is True
            assert record["source_url"] is None
    assert all(item["doi"] is None for item in sea_ice["publications"])


def test_new_document_appears_on_its_expedition(reviewed_pdf) -> None:
    expedition = client.get(f"/api/expeditions/{SEA_ICE_EXPEDITION_ID}").json()

    document = next(
        item for item in expedition["source_documents"] if item["id"] == reviewed_pdf
    )
    assert document["verification_status"] == "reviewed"
    assert document["source_url"] == SOURCE_URL
    assert document["publication_date"] == "2024-03-15"


def test_search_results_include_provenance_fields() -> None:
    seed_demo_documents()

    response = client.get("/api/search", params={"q": "climate"})

    assert response.status_code == 200
    results = response.json()
    assert results
    for item in results:
        assert "verification_status" in item
        assert "is_demo_data" in item
        # Demo records have no source. A real record always names one.
        if item["is_demo_data"]:
            assert item["source_url"] is None
        elif item["type"] in ("publication", "dataset", "report"):
            assert item["source_url"].startswith("http")
