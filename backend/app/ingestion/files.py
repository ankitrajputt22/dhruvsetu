"""Finding the stored file of a document, safely.

A file is only ever looked up from a document record. The record must point at
a PDF or TXT file directly inside the document store. Anything else, such as a
path that leads out of the store, is treated as having no file.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.ingestion.service import BACKEND_ROOT, DOCUMENT_STORE
from app.models import Document

# The file types that can be stored, and how each is sent to a browser.
MEDIA_TYPES = {
    "pdf": "application/pdf",
    "txt": "text/plain; charset=utf-8",
}
# A text file larger than this is not shown inside the page.
TEXT_PREVIEW_BYTES = 1024 * 1024

FILE_UNAVAILABLE = "The stored file for this document is currently unavailable."
TYPE_NOT_PREVIEWED = "Preview is not available for this file type."
TEXT_TOO_LARGE = "This text file is too large to preview here. Open or download it instead."


@dataclass(frozen=True)
class DocumentFile:
    path: Path
    # The name the file is given when it is opened or downloaded.
    file_name: str
    file_type: str
    size_bytes: int
    media_type: str


def has_stored_file(document: Document) -> bool:
    """Whether the record says DhruvSetu holds a copy of the document."""
    return bool((document.file_path or "").strip())


def _download_name(document: Document, file_type: str) -> str:
    # The recorded name is only a label. It is cleaned before it is sent.
    name = Path((document.file_name or "").replace("\\", "/")).name
    name = "".join(character for character in name if character.isprintable())
    name = name.replace('"', "").strip(" .")
    if not name.casefold().endswith(f".{file_type}"):
        name = f"document.{file_type}"
    return name


def find_document_file(document: Document) -> DocumentFile | None:
    """Return the stored file of a document, or None when it cannot be served."""
    recorded = (document.file_path or "").strip()
    if not recorded:
        return None

    recorded_path = Path(recorded)
    name = recorded_path.name
    file_type = recorded_path.suffix.casefold().lstrip(".")
    if not name or name.startswith(".") or "\\" in recorded:
        return None
    if file_type not in MEDIA_TYPES or file_type != document.file_type:
        return None

    store = DOCUMENT_STORE.resolve()
    if not recorded_path.is_absolute():
        recorded_path = BACKEND_ROOT / recorded_path
    # Resolving follows ".." and links, so a path that ends up anywhere but
    # directly inside the store is refused.
    path = recorded_path.resolve()
    if path.parent != store or not path.is_file():
        return None

    if file_type == "pdf":
        with path.open("rb") as stream:
            if stream.read(5) != b"%PDF-":
                return None

    return DocumentFile(
        path=path,
        file_name=_download_name(document, file_type),
        file_type=file_type,
        size_bytes=path.stat().st_size,
        media_type=MEDIA_TYPES[file_type],
    )
