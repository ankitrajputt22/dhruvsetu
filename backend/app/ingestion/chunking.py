from __future__ import annotations

from dataclasses import dataclass

from app.ingestion.extractors import ExtractedText

DEFAULT_CHUNK_SIZE = 1200
DEFAULT_CHUNK_OVERLAP = 150


@dataclass(frozen=True)
class TextChunk:
    chunk_number: int
    text: str
    page_number: int | None
    section_name: str | None = None


def create_chunks(
    extracted: list[ExtractedText],
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[TextChunk]:
    if chunk_size < 200:
        raise ValueError("Chunk size must be at least 200 characters")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("Chunk overlap must be smaller than the chunk size")

    chunks: list[TextChunk] = []
    for source in extracted:
        for text in _split_text(source.text, chunk_size=chunk_size, overlap=overlap):
            chunks.append(
                TextChunk(
                    chunk_number=len(chunks) + 1,
                    text=text,
                    page_number=source.page_number,
                )
            )
    return chunks


def _split_text(text: str, *, chunk_size: int, overlap: int) -> list[str]:
    text = text.strip()
    if not text:
        return []

    parts = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            minimum_break = start + int(chunk_size * 0.6)
            whitespace_break = max(
                text.rfind("\n", minimum_break, end),
                text.rfind(" ", minimum_break, end),
            )
            if whitespace_break > start:
                end = whitespace_break + 1

        chunk = text[start:end].strip()
        if chunk:
            parts.append(chunk)
        if end >= len(text):
            break

        next_start = max(start + 1, end - overlap)
        while next_start > start and not text[next_start - 1].isspace():
            next_start -= 1
        start = next_start

    return parts
