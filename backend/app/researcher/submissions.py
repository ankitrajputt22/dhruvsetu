"""Documents and datasets submitted by researchers.

A submission goes through the same steps as records added by the project: a
document is ingested into chunks, and a dataset file is attached to its record.
Every submission starts as Uploaded and is never marked as demo data.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.datasets.files import DatasetFile, DatasetFileError, attach_dataset_file
from app.datasets.preview import (
    MAX_PREVIEW_FILE_BYTES,
    PREVIEW_FILE_TYPES,
    PreviewError,
    build_preview,
)
from app.ingestion.extractors import (
    MAX_FILE_SIZE_BYTES,
    SUPPORTED_FILE_TYPES,
    DocumentExtractionError,
)
from app.ingestion.service import DocumentIngestionError, ingest_document
from app.models import Dataset, Document, Expedition, ResearchTopic, User
from app.researcher.uploads import UploadedFile
from app.schemas import DatasetSubmission, DocumentSubmission, SubmissionItem

# The limits already used by document ingestion and by the dataset preview.
MAX_DOCUMENT_BYTES = MAX_FILE_SIZE_BYTES
MAX_DATASET_BYTES = MAX_PREVIEW_FILE_BYTES
DATASET_FILE_TYPES = PREVIEW_FILE_TYPES


class SubmissionRejected(Exception):
    """The submission was refused. The message is safe to show."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _sentence(message: str) -> str:
    return message if message.endswith(".") else f"{message}."


def submit_document(
    db: Session,
    user: User,
    details: DocumentSubmission,
    upload: UploadedFile,
) -> Document:
    if upload.file_type not in SUPPORTED_FILE_TYPES:
        raise SubmissionRejected(422, "Only PDF and TXT documents are supported.")

    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / upload.name
        path.write_bytes(upload.data)
        try:
            result = ingest_document(
                db,
                path,
                title=details.title,
                source_type=details.document_type,
                source_url=details.source_url,
                publication_date=details.publication_date,
                expedition_id=details.expedition_id,
                # Set here, never taken from the request.
                verification_status="uploaded",
                is_demo_data=False,
                submitted_by_user_id=user.id,
            )
        except (DocumentExtractionError, DocumentIngestionError) as error:
            raise SubmissionRejected(422, _sentence(str(error))) from error

    if result.duplicate:
        raise SubmissionRejected(409, "This document is already in the repository.")
    return result.document


def submit_dataset(
    db: Session,
    user: User,
    details: DatasetSubmission,
    upload: UploadedFile,
) -> Dataset:
    if upload.file_type not in DATASET_FILE_TYPES:
        raise SubmissionRejected(422, "Only CSV and JSON data files can be submitted.")

    expedition = topic = None
    if details.expedition_id is not None:
        expedition = db.get(Expedition, details.expedition_id)
        if expedition is None:
            raise SubmissionRejected(422, "The related expedition was not found.")
    if details.topic_id is not None:
        topic = db.get(ResearchTopic, details.topic_id)
        if topic is None:
            raise SubmissionRejected(422, "The research topic was not found.")

    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / f"upload.{upload.file_type}"
        path.write_bytes(upload.data)
        # The file must open as a table in the Dataset Explorer, so a reviewer
        # can look at what was submitted.
        try:
            build_preview(
                DatasetFile(
                    path=path,
                    file_name=path.name,
                    file_type=upload.file_type,
                    size_bytes=len(upload.data),
                )
            )
        except PreviewError as error:
            raise SubmissionRejected(422, _sentence(str(error))) from error

        dataset = Dataset(
            title=details.title,
            description=details.description,
            source_url=details.source_url,
            # Set here, never taken from the request.
            verification_status="uploaded",
            is_demo_data=False,
            submitted_by_user_id=user.id,
            expeditions=[expedition] if expedition else [],
            research_topics=[topic] if topic else [],
        )
        db.add(dataset)
        db.commit()
        try:
            # Stores the file under a name made from the record ID.
            attach_dataset_file(db, dataset.id, path)
        except DatasetFileError as error:
            db.delete(dataset)
            db.commit()
            raise SubmissionRejected(422, _sentence(str(error))) from error
    return dataset


def _document_item(document: Document) -> SubmissionItem:
    return SubmissionItem(
        type="document",
        id=document.id,
        title=document.title,
        file_type=document.file_type,
        verification_status=document.verification_status,
        created_at=document.created_at,
        href=f"/documents/{document.id}",
    )


def _dataset_item(dataset: Dataset) -> SubmissionItem:
    return SubmissionItem(
        type="dataset",
        id=dataset.id,
        title=dataset.title,
        file_type=dataset.file_type,
        verification_status=dataset.verification_status,
        created_at=dataset.created_at,
        href=f"/datasets/{dataset.id}",
    )


def submission_item(record: Document | Dataset) -> SubmissionItem:
    return _document_item(record) if isinstance(record, Document) else _dataset_item(record)


def list_submissions(db: Session, user: User) -> list[SubmissionItem]:
    """The documents and datasets this account submitted, newest first."""
    documents = db.scalars(
        select(Document).where(Document.submitted_by_user_id == user.id)
    ).all()
    datasets = db.scalars(
        select(Dataset).where(Dataset.submitted_by_user_id == user.id)
    ).all()
    items = [_document_item(item) for item in documents] + [
        _dataset_item(item) for item in datasets
    ]
    return sorted(items, key=lambda item: (item.created_at, item.id), reverse=True)
