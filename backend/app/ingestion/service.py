from __future__ import annotations

import hashlib
import shutil
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.ingestion.chunking import create_chunks
from app.ingestion.extractors import detect_file_type, extract_document
from app.models import Document, DocumentChunk, Expedition, Publication, Report

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DOCUMENT_STORE = BACKEND_ROOT / "data" / "documents"


class DocumentIngestionError(ValueError):
    pass


@dataclass(frozen=True)
class IngestionResult:
    document: Document
    chunk_count: int
    duplicate: bool


def ingest_document(
    session: Session,
    file_path: Path,
    *,
    title: str | None = None,
    source_type: str = "local_file",
    source_url: str | None = None,
    publication_date: date | None = None,
    verification_status: str = "uploaded",
    is_demo_data: bool = False,
    publication_id: str | None = None,
    report_id: str | None = None,
    expedition_id: str | None = None,
    document_store: Path = DOCUMENT_STORE,
) -> IngestionResult:
    path = file_path.expanduser().resolve()
    if not path.is_file():
        raise DocumentIngestionError("The document file does not exist")

    detect_file_type(path)
    file_hash = _hash_file(path)
    existing = session.scalar(select(Document).where(Document.file_hash == file_hash))
    if existing is not None:
        return IngestionResult(
            document=existing,
            chunk_count=len(existing.chunks),
            duplicate=True,
        )

    document_title = (title or path.stem.replace("-", " ").strip()).strip()
    _validate_metadata(
        title=document_title,
        file_name=path.name,
        source_type=source_type,
        source_url=source_url,
        verification_status=verification_status,
    )
    _validate_relationships(
        session,
        publication_id=publication_id,
        report_id=report_id,
        expedition_id=expedition_id,
    )

    file_type, extracted = extract_document(path)
    chunks = create_chunks(extracted)
    if not chunks:
        raise DocumentIngestionError("The document has no text chunks")

    stored_path, copied_file = _store_file(
        path,
        file_hash=file_hash,
        document_store=document_store,
    )
    document = Document(
        title=document_title,
        file_name=path.name,
        file_type=file_type,
        file_path=_portable_path(stored_path),
        file_hash=file_hash,
        source_url=source_url,
        source_type=source_type,
        publication_date=publication_date,
        verification_status=verification_status,
        is_demo_data=is_demo_data,
        publication_id=publication_id,
        report_id=report_id,
        expedition_id=expedition_id,
        chunks=[
            DocumentChunk(
                chunk_number=chunk.chunk_number,
                text=chunk.text,
                page_number=chunk.page_number,
                section_name=chunk.section_name,
            )
            for chunk in chunks
        ],
    )
    try:
        session.add(document)
        session.commit()
        session.refresh(document)
    except SQLAlchemyError:
        session.rollback()
        if copied_file:
            stored_path.unlink(missing_ok=True)
        raise

    return IngestionResult(
        document=document,
        chunk_count=len(chunks),
        duplicate=False,
    )


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _validate_metadata(
    *,
    title: str,
    file_name: str,
    source_type: str,
    source_url: str | None,
    verification_status: str,
) -> None:
    if not title or len(title) > 500:
        raise DocumentIngestionError(
            "Document title must be between 1 and 500 characters"
        )
    if len(file_name) > 255:
        raise DocumentIngestionError("Document file name is too long")
    if not source_type.strip() or len(source_type) > 50:
        raise DocumentIngestionError("Source type must be between 1 and 50 characters")
    if source_url is not None and len(source_url) > 2048:
        raise DocumentIngestionError("Source URL is too long")
    if verification_status not in {"uploaded", "verified"}:
        raise DocumentIngestionError("Verification status must be uploaded or verified")


def _validate_relationships(
    session: Session,
    *,
    publication_id: str | None,
    report_id: str | None,
    expedition_id: str | None,
) -> None:
    for model, record_id, label in (
        (Publication, publication_id, "publication"),
        (Report, report_id, "report"),
        (Expedition, expedition_id, "expedition"),
    ):
        if record_id is not None and session.get(model, record_id) is None:
            raise DocumentIngestionError(f"The related {label} was not found")


def _store_file(
    path: Path,
    *,
    file_hash: str,
    document_store: Path,
) -> tuple[Path, bool]:
    store = document_store.resolve()
    store.mkdir(parents=True, exist_ok=True)
    if path.parent == store:
        return path, False

    destination = store / f"{file_hash}{path.suffix.casefold()}"
    if not destination.exists():
        shutil.copy2(path, destination)
        return destination, True
    return destination, False


def _portable_path(path: Path) -> str:
    try:
        return path.relative_to(BACKEND_ROOT).as_posix()
    except ValueError:
        return str(path)
