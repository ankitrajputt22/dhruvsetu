import hashlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from sqlalchemy import func, select

from app.database import SessionLocal
from app.ingestion.extractors import DocumentExtractionError, extract_document
from app.ingestion.retrieval import retrieve_source_chunks
from app.ingestion.seed_demo import DEMO_DOCUMENTS, seed_demo_documents
from app.ingestion.service import ingest_document
from app.main import app
from app.models import Document, DocumentChunk
from app.search.semantic import DOCUMENT_CHUNK_TYPE, SemanticMatch

client = TestClient(app)


def _file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _delete_test_document(file_hash: str) -> None:
    with SessionLocal() as session:
        document = session.scalar(
            select(Document).where(Document.file_hash == file_hash)
        )
        if document is not None and document.is_demo_data:
            session.delete(document)
            session.commit()


def _write_text_pdf(path: Path, page_texts: list[str]) -> None:
    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    font_reference = writer._add_object(font)
    for text in page_texts:
        page = writer.add_blank_page(width=300, height=300)
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): font_reference}
                )
            }
        )
        content = DecodedStreamObject()
        safe_text = (
            text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        )
        content.set_data(
            f"BT /F1 12 Tf 30 250 Td ({safe_text}) Tj ET".encode("ascii")
        )
        page[NameObject("/Contents")] = writer._add_object(content)
    with path.open("wb") as stream:
        writer.write(stream)


def test_txt_ingestion_creates_chunks_and_prevents_duplicates(tmp_path) -> None:
    source = tmp_path / "source.txt"
    source.write_text(
        "Demo Antarctic climate observations and careful source notes. " * 45,
        encoding="utf-8",
    )
    digest = _file_hash(source)
    _delete_test_document(digest)

    try:
        with SessionLocal() as session:
            first = ingest_document(
                session,
                source,
                title="Test ingestion TXT source",
                is_demo_data=True,
                document_store=tmp_path / "stored",
            )
            second = ingest_document(
                session,
                source,
                title="Test ingestion duplicate",
                is_demo_data=True,
                document_store=tmp_path / "stored",
            )

            count = session.scalar(
                select(func.count())
                .select_from(Document)
                .where(Document.file_hash == digest)
            )
            chunks = session.scalars(
                select(DocumentChunk)
                .where(DocumentChunk.document_id == first.document.id)
                .order_by(DocumentChunk.chunk_number)
            ).all()

        assert first.duplicate is False
        assert first.chunk_count >= 2
        assert second.duplicate is True
        assert second.document.id == first.document.id
        assert count == 1
        assert all(chunk.page_number is None for chunk in chunks)
    finally:
        _delete_test_document(digest)


def test_pdf_ingestion_preserves_page_numbers(tmp_path) -> None:
    source = tmp_path / "source.pdf"
    _write_text_pdf(
        source,
        [
            "Antarctic climate observations on the first page.",
            "Sea ice field notes on the second page.",
        ],
    )
    digest = _file_hash(source)
    _delete_test_document(digest)

    try:
        file_type, extracted = extract_document(source)
        with SessionLocal() as session:
            result = ingest_document(
                session,
                source,
                title="Test ingestion PDF source",
                is_demo_data=True,
                document_store=tmp_path / "stored",
            )
            chunks = session.scalars(
                select(DocumentChunk)
                .where(DocumentChunk.document_id == result.document.id)
                .order_by(DocumentChunk.chunk_number)
            ).all()

        assert file_type == "pdf"
        assert [page.page_number for page in extracted] == [1, 2]
        assert "Antarctic climate" in extracted[0].text
        assert "Sea ice" in extracted[1].text
        assert [chunk.page_number for chunk in chunks] == [1, 2]
    finally:
        _delete_test_document(digest)


def test_ingestion_rejects_unsupported_file_type(tmp_path) -> None:
    source = tmp_path / "source.csv"
    source.write_text("not,a,supported,document", encoding="utf-8")

    with pytest.raises(DocumentExtractionError, match="Only PDF and TXT"):
        extract_document(source)


def test_ingestion_checks_pdf_content_not_only_extension(tmp_path) -> None:
    source = tmp_path / "source.pdf"
    source.write_text("This is plain text, not a PDF.", encoding="utf-8")

    with pytest.raises(DocumentExtractionError, match="valid PDF header"):
        extract_document(source)


def test_document_api_returns_sources_without_raw_chunks() -> None:
    seed_demo_documents()

    response = client.get("/api/documents")

    assert response.status_code == 200
    demo_documents = [item for item in response.json() if item["is_demo_data"]]
    assert len(demo_documents) >= len(DEMO_DOCUMENTS)
    document_id = demo_documents[0]["id"]
    detail = client.get(f"/api/documents/{document_id}")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["chunk_count"] >= 1
    assert payload["related_resources"]
    assert "chunks" not in payload
    assert "file_path" not in payload
    assert "file_hash" not in payload


def test_missing_document_returns_404() -> None:
    response = client.get("/api/documents/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found"}


def test_source_retrieval_returns_ranked_source(monkeypatch) -> None:
    seed_demo_documents()
    with SessionLocal() as session:
        chunk = session.scalar(
            select(DocumentChunk)
            .join(Document)
            .where(Document.title == "Demo Antarctic Climate Field Notes")
        )
        assert chunk is not None

        def fake_search(query, *, resource_type=None, limit=10):
            assert query == "What does the source say about Antarctic climate?"
            assert resource_type == DOCUMENT_CHUNK_TYPE
            assert limit == 3
            return [
                SemanticMatch(
                    resource_type=DOCUMENT_CHUNK_TYPE,
                    record_id=chunk.id,
                    document_id=chunk.document_id,
                    page_number=chunk.page_number,
                    score=0.91,
                )
            ]

        monkeypatch.setattr(
            "app.ingestion.retrieval.search_semantic_index",
            fake_search,
        )
        results = retrieve_source_chunks(
            session,
            "What does the source say about Antarctic climate?",
            limit=3,
        )

    assert len(results) == 1
    assert results[0].rank == 1
    assert results[0].document_title == "Demo Antarctic Climate Field Notes"
    assert "climate" in results[0].text.casefold()
