from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from app.database import SessionLocal
from app.ingestion.service import DocumentIngestionError, ingest_document
from app.ingestion.extractors import DocumentExtractionError


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("Use YYYY-MM-DD for dates") from error


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingest a PDF or TXT source document")
    parser.add_argument("file", type=Path)
    parser.add_argument("--title")
    parser.add_argument("--source-type", default="local_file")
    parser.add_argument("--source-url")
    parser.add_argument("--publication-date", type=_parse_date)
    parser.add_argument(
        "--verification-status",
        choices=("uploaded", "verified"),
        default="uploaded",
    )
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--publication-id")
    parser.add_argument("--report-id")
    parser.add_argument("--expedition-id")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        with SessionLocal() as session:
            result = ingest_document(
                session,
                args.file,
                title=args.title,
                source_type=args.source_type,
                source_url=args.source_url,
                publication_date=args.publication_date,
                verification_status=args.verification_status,
                is_demo_data=args.demo,
                publication_id=args.publication_id,
                report_id=args.report_id,
                expedition_id=args.expedition_id,
            )
    except (DocumentExtractionError, DocumentIngestionError) as error:
        raise SystemExit(f"Document was not ingested: {error}") from error

    if result.duplicate:
        print(f"Document already stored: {result.document.title}")
    else:
        print(f"Ingested document: {result.document.title}")
    print(f"Document ID: {result.document.id}")
    print(f"Chunks: {result.chunk_count}")


if __name__ == "__main__":
    main()
