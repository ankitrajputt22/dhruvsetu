from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Dataset,
    DocumentChunk,
    Expedition,
    Publication,
    Report,
    ResearchTopic,
    Scientist,
)
from app.schemas import SearchResourceType

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MODEL_NAME = "minishlab/potion-base-8M"
MODEL_CACHE_DIR = BACKEND_ROOT / ".cache" / "huggingface"
INDEX_DIR = BACKEND_ROOT / "data" / "semantic_search"
VECTOR_FILE_NAME = "vectors.npz"
METADATA_FILE_NAME = "metadata.json"
INDEX_VERSION = 2
SEMANTIC_RESULT_LIMIT = 10
DOCUMENT_CHUNK_TYPE = "document_chunk"

os.environ.setdefault("HF_HOME", str(MODEL_CACHE_DIR))


class SemanticSearchUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class SearchDocument:
    resource_type: SearchResourceType | str
    record_id: str
    text: str
    document_id: str | None = None
    page_number: int | None = None


@dataclass(frozen=True)
class SemanticMatch:
    resource_type: SearchResourceType | str
    record_id: str
    score: float
    document_id: str | None = None
    page_number: int | None = None


SEARCHABLE_SOURCES = (
    (SearchResourceType.expedition, Expedition, "name", "summary"),
    (SearchResourceType.scientist, Scientist, "name", "research_area"),
    (SearchResourceType.publication, Publication, "title", "summary"),
    (SearchResourceType.dataset, Dataset, "title", "description"),
    (SearchResourceType.topic, ResearchTopic, "name", "description"),
    (SearchResourceType.report, Report, "title", "summary"),
)


def _normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return vectors / norms


@lru_cache(maxsize=1)
def _get_model():
    try:
        from model2vec import StaticModel

        return StaticModel.from_pretrained(
            MODEL_NAME,
            normalize=True,
            force_download=False,
        )
    except Exception as error:
        raise SemanticSearchUnavailable(
            "The local embedding model is not available"
        ) from error


def _encode(texts: list[str]) -> np.ndarray:
    try:
        embeddings = _get_model().encode(texts, show_progress_bar=False)
    except SemanticSearchUnavailable:
        raise
    except Exception as error:
        raise SemanticSearchUnavailable("Could not generate embeddings") from error

    vectors = np.asarray(embeddings, dtype=np.float32)
    if vectors.ndim != 2 or len(vectors) != len(texts):
        raise SemanticSearchUnavailable("The embedding model returned invalid data")
    return _normalize(vectors)


def collect_search_documents(db: Session) -> list[SearchDocument]:
    documents = []
    for resource_type, model, title_attribute, description_attribute in SEARCHABLE_SOURCES:
        records = db.scalars(select(model).order_by(model.id)).all()
        for record in records:
            title = getattr(record, title_attribute)
            description = getattr(record, description_attribute) or ""
            documents.append(
                SearchDocument(
                    resource_type=resource_type,
                    record_id=record.id,
                    text=f"{resource_type.value}: {title}. {description}".strip(),
                )
            )

    chunks = db.scalars(
        select(DocumentChunk)
        .options(selectinload(DocumentChunk.document))
        .order_by(DocumentChunk.document_id, DocumentChunk.chunk_number)
    ).all()
    for chunk in chunks:
        documents.append(
            SearchDocument(
                resource_type=DOCUMENT_CHUNK_TYPE,
                record_id=chunk.id,
                document_id=chunk.document_id,
                page_number=chunk.page_number,
                text=f"document: {chunk.document.title}. {chunk.text}",
            )
        )
    return documents


def _resource_type_value(resource_type: SearchResourceType | str) -> str:
    if isinstance(resource_type, SearchResourceType):
        return resource_type.value
    return resource_type


def build_semantic_index(
    db: Session,
    *,
    index_dir: Path = INDEX_DIR,
) -> int:
    documents = collect_search_documents(db)
    if not documents:
        raise SemanticSearchUnavailable("No searchable records are available")

    vectors = _encode([document.text for document in documents])
    metadata = {
        "version": INDEX_VERSION,
        "model": MODEL_NAME,
        "records": [
            {
                "type": _resource_type_value(document.resource_type),
                "id": document.record_id,
                "document_id": document.document_id,
                "page_number": document.page_number,
            }
            for document in documents
        ],
    }

    index_dir.mkdir(parents=True, exist_ok=True)
    suffix = uuid4().hex
    temporary_vectors = index_dir / f".vectors-{suffix}.npz"
    temporary_metadata = index_dir / f".metadata-{suffix}.json"
    try:
        np.savez_compressed(temporary_vectors, vectors=vectors)
        temporary_metadata.write_text(
            json.dumps(metadata, indent=2),
            encoding="utf-8",
        )
        temporary_vectors.replace(index_dir / VECTOR_FILE_NAME)
        temporary_metadata.replace(index_dir / METADATA_FILE_NAME)
    finally:
        temporary_vectors.unlink(missing_ok=True)
        temporary_metadata.unlink(missing_ok=True)

    return len(documents)


def _load_semantic_index(
    *,
    index_dir: Path = INDEX_DIR,
) -> tuple[np.ndarray, list[SearchDocument]]:
    vector_path = index_dir / VECTOR_FILE_NAME
    metadata_path = index_dir / METADATA_FILE_NAME
    if not vector_path.is_file() or not metadata_path.is_file():
        raise SemanticSearchUnavailable("The semantic search index has not been built")

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        with np.load(vector_path, allow_pickle=False) as stored:
            vectors = np.asarray(stored["vectors"], dtype=np.float32)

        if metadata.get("version") != INDEX_VERSION:
            raise ValueError("Unsupported index version")
        if metadata.get("model") != MODEL_NAME:
            raise ValueError("Index model does not match")

        documents = []
        for item in metadata["records"]:
            raw_type = item["type"]
            resource_type = (
                DOCUMENT_CHUNK_TYPE
                if raw_type == DOCUMENT_CHUNK_TYPE
                else SearchResourceType(raw_type)
            )
            documents.append(
                SearchDocument(
                    resource_type=resource_type,
                    record_id=item["id"],
                    text="",
                    document_id=item.get("document_id"),
                    page_number=item.get("page_number"),
                )
            )
        if vectors.ndim != 2 or len(vectors) != len(documents):
            raise ValueError("Index files do not match")
    except (
        AttributeError,
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        OSError,
    ) as error:
        raise SemanticSearchUnavailable(
            "The semantic search index could not be loaded"
        ) from error

    return _normalize(vectors), documents


def search_semantic_index(
    query: str,
    *,
    resource_type: SearchResourceType | str | None = None,
    limit: int = SEMANTIC_RESULT_LIMIT,
    index_dir: Path = INDEX_DIR,
) -> list[SemanticMatch]:
    vectors, documents = _load_semantic_index(index_dir=index_dir)
    query_vector = _encode([query])[0]

    requested_type = (
        _resource_type_value(resource_type) if resource_type is not None else None
    )
    candidate_indexes = []
    for index, document in enumerate(documents):
        document_type = _resource_type_value(document.resource_type)
        if requested_type is None and document_type == DOCUMENT_CHUNK_TYPE:
            continue
        if requested_type is not None and document_type != requested_type:
            continue
        candidate_indexes.append(index)
    if not candidate_indexes:
        return []

    scores = vectors[candidate_indexes] @ query_vector
    ranked_positions = np.argsort(-scores, kind="stable")[:limit]
    return [
        SemanticMatch(
            resource_type=documents[candidate_indexes[position]].resource_type,
            record_id=documents[candidate_indexes[position]].record_id,
            score=float(scores[position]),
            document_id=documents[candidate_indexes[position]].document_id,
            page_number=documents[candidate_indexes[position]].page_number,
        )
        for position in ranked_positions
    ]
