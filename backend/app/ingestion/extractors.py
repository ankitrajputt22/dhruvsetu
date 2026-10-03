from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PdfReadError

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
SUPPORTED_FILE_TYPES = {"pdf", "txt"}


class DocumentExtractionError(ValueError):
    pass


@dataclass(frozen=True)
class ExtractedText:
    text: str
    page_number: int | None


def detect_file_type(path: Path) -> str:
    if not path.is_file():
        raise DocumentExtractionError("The document file does not exist")
    if path.stat().st_size > MAX_FILE_SIZE_BYTES:
        raise DocumentExtractionError("The document is larger than 20 MB")

    suffix = path.suffix.casefold().lstrip(".")
    if suffix not in SUPPORTED_FILE_TYPES:
        raise DocumentExtractionError("Only PDF and TXT documents are supported")

    with path.open("rb") as stream:
        header = stream.read(5)

    if suffix == "pdf" and header != b"%PDF-":
        raise DocumentExtractionError("The file does not contain a valid PDF header")
    if suffix == "txt" and header == b"%PDF-":
        raise DocumentExtractionError("The file content does not match its TXT extension")

    return suffix


def extract_document(path: Path) -> tuple[str, list[ExtractedText]]:
    file_type = detect_file_type(path)
    if file_type == "pdf":
        extracted = _extract_pdf(path)
    else:
        extracted = _extract_txt(path)

    if not any(item.text.strip() for item in extracted):
        raise DocumentExtractionError("The document has no extractable text")
    return file_type, extracted


def _extract_pdf(path: Path) -> list[ExtractedText]:
    try:
        reader = PdfReader(path, strict=False)
        if reader.is_encrypted:
            raise DocumentExtractionError("Encrypted PDFs are not supported")
        return [
            ExtractedText(text=page.extract_text() or "", page_number=index)
            for index, page in enumerate(reader.pages, start=1)
        ]
    except DocumentExtractionError:
        raise
    except (OSError, PdfReadError) as error:
        raise DocumentExtractionError("The PDF could not be read") from error


def _extract_txt(path: Path) -> list[ExtractedText]:
    try:
        content = path.read_bytes()
        if b"\x00" in content:
            raise DocumentExtractionError("The TXT file contains binary data")
        text = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise DocumentExtractionError("TXT documents must use UTF-8 encoding") from error
    except OSError as error:
        raise DocumentExtractionError("The TXT file could not be read") from error
    return [ExtractedText(text=text, page_number=None)]
