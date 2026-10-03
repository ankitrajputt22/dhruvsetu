from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import DocumentChunk
from app.search.semantic import DOCUMENT_CHUNK_TYPE, search_semantic_index


@dataclass(frozen=True)
class RetrievedSourceChunk:
    rank: int
    score: float
    document_id: str
    document_title: str
    chunk_id: str
    text: str
    page_number: int | None
    file_type: str | None = None
    source_type: str | None = None
    source_url: str | None = None
    verification_status: str | None = None
    is_demo_data: bool = False


def retrieve_source_chunks(
    session: Session,
    question: str,
    *,
    limit: int = 5,
) -> list[RetrievedSourceChunk]:
    query = question.strip()
    if not query:
        raise ValueError("Question cannot be empty")
    if limit < 1 or limit > 20:
        raise ValueError("Limit must be between 1 and 20")

    matches = search_semantic_index(
        query,
        resource_type=DOCUMENT_CHUNK_TYPE,
        limit=limit,
    )
    chunk_ids = [match.record_id for match in matches]
    chunks = session.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.id.in_(chunk_ids))
        .options(selectinload(DocumentChunk.document))
    ).all()
    chunks_by_id = {chunk.id: chunk for chunk in chunks}

    retrieved = []
    for match in matches:
        chunk = chunks_by_id.get(match.record_id)
        if chunk is None:
            continue
        retrieved.append(
            RetrievedSourceChunk(
                rank=len(retrieved) + 1,
                score=match.score,
                document_id=chunk.document_id,
                document_title=chunk.document.title,
                chunk_id=chunk.id,
                text=chunk.text,
                page_number=chunk.page_number,
                file_type=chunk.document.file_type,
                source_type=chunk.document.source_type,
                source_url=chunk.document.source_url,
                verification_status=chunk.document.verification_status,
                is_demo_data=chunk.document.is_demo_data,
            )
        )
    return retrieved
