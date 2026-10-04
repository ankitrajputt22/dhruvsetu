from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Dataset, Document, Expedition, Publication, Report
from app.provenance import RELATED_RESOURCE_ROUTES, related_document_resources
from app.schemas import OutreachResourceType, RelatedDocumentResource

SOURCE_LIST_LIMIT = 25

TYPE_LABELS = {
    OutreachResourceType.expedition: "Expedition",
    OutreachResourceType.publication: "Publication",
    OutreachResourceType.dataset: "Dataset",
    OutreachResourceType.document: "Document",
    OutreachResourceType.report: "Report",
}

# model, title column, text column searched with the title (if any)
MODELS = {
    OutreachResourceType.expedition: (Expedition, Expedition.name, Expedition.summary),
    OutreachResourceType.publication: (Publication, Publication.title, Publication.summary),
    OutreachResourceType.dataset: (Dataset, Dataset.title, Dataset.description),
    OutreachResourceType.document: (Document, Document.title, None),
    OutreachResourceType.report: (Report, Report.title, Report.summary),
}


@dataclass(frozen=True)
class Fact:
    label: str
    value: str


@dataclass(frozen=True)
class Topic:
    name: str
    description: str | None


@dataclass(frozen=True)
class MediaReference:
    title: str
    media_type: str


@dataclass(frozen=True)
class OutreachSource:
    """Everything a draft may use. Each value comes straight from the repository."""

    resource_type: OutreachResourceType
    id: str
    title: str
    summary: str | None
    verification_status: str
    is_demo_data: bool
    source_url: str | None
    href: str | None
    facts: list[Fact] = field(default_factory=list)
    topics: list[Topic] = field(default_factory=list)
    related_resources: list[RelatedDocumentResource] = field(default_factory=list)
    media: list[MediaReference] = field(default_factory=list)

    @property
    def type_label(self) -> str:
        return TYPE_LABELS[self.resource_type]


def format_date(value: date) -> str:
    return f"{value.day} {value:%B %Y}"


def _names(records, attribute: str = "name") -> str:
    return ", ".join(sorted(getattr(record, attribute) for record in records))


def _add(facts: list[Fact], label: str, value: object) -> None:
    """Add a fact only when the repository actually has a value for it."""
    if value is None:
        return
    text = str(value).strip()
    if text:
        facts.append(Fact(label, text))


def _topics(records) -> list[Topic]:
    return [
        Topic(record.name, (record.description or "").strip() or None)
        for record in sorted(records, key=lambda item: item.name)
    ]


def _expedition_links(expeditions) -> list[RelatedDocumentResource]:
    return [
        RelatedDocumentResource(
            id=expedition.id,
            type="expedition",
            title=expedition.name,
            href=RELATED_RESOURCE_ROUTES["expedition"].format(id=expedition.id),
        )
        for expedition in sorted(expeditions, key=lambda item: item.name)
    ]


def _clean(text: str | None) -> str | None:
    return (text or "").strip() or None


def _expedition(db: Session, record_id: str) -> OutreachSource | None:
    record = db.scalar(
        select(Expedition)
        .where(Expedition.id == record_id)
        .options(
            selectinload(Expedition.scientists),
            selectinload(Expedition.research_topics),
            selectinload(Expedition.locations),
            selectinload(Expedition.publications),
            selectinload(Expedition.reports),
            selectinload(Expedition.datasets),
            selectinload(Expedition.media_assets),
        )
    )
    if record is None:
        return None

    facts: list[Fact] = []
    _add(facts, "Expedition number", record.expedition_number)
    _add(facts, "Start date", record.start_date and format_date(record.start_date))
    _add(facts, "End date", record.end_date and format_date(record.end_date))
    _add(facts, "Research topics", _names(record.research_topics))
    _add(facts, "Scientists", _names(record.scientists))
    _add(facts, "Locations", _names(record.locations))
    linked = [
        f"{len(items)} {word if len(items) == 1 else word + 's'}"
        for items, word in (
            (record.publications, "publication"),
            (record.reports, "report"),
            (record.datasets, "dataset"),
        )
        if items
    ]
    _add(facts, "Linked records", ", ".join(linked))

    return OutreachSource(
        resource_type=OutreachResourceType.expedition,
        id=record.id,
        title=record.name,
        summary=_clean(record.summary),
        verification_status=record.verification_status,
        is_demo_data=record.is_demo_data,
        source_url=record.source_url,
        href=f"/expeditions/{record.id}",
        facts=facts,
        topics=_topics(record.research_topics),
        media=[
            MediaReference(item.title, item.media_type)
            for item in sorted(record.media_assets, key=lambda item: item.title)
        ],
    )


def _publication(db: Session, record_id: str) -> OutreachSource | None:
    record = db.scalar(
        select(Publication)
        .where(Publication.id == record_id)
        .options(
            selectinload(Publication.scientists),
            selectinload(Publication.research_topics),
            selectinload(Publication.expeditions),
        )
    )
    if record is None:
        return None

    facts: list[Fact] = []
    _add(facts, "Authors", record.authors)
    _add(facts, "Journal", record.journal)
    _add(facts, "Year", record.publication_year)
    _add(facts, "DOI", record.doi)
    _add(facts, "Scientists", _names(record.scientists))
    _add(facts, "Research topics", _names(record.research_topics))
    _add(facts, "Related expeditions", _names(record.expeditions))

    return OutreachSource(
        resource_type=OutreachResourceType.publication,
        id=record.id,
        title=record.title,
        summary=_clean(record.summary),
        verification_status=record.verification_status,
        is_demo_data=record.is_demo_data,
        source_url=record.source_url,
        href=RELATED_RESOURCE_ROUTES["publication"].format(id=record.id),
        facts=facts,
        topics=_topics(record.research_topics),
        related_resources=_expedition_links(record.expeditions),
    )


def _dataset(db: Session, record_id: str) -> OutreachSource | None:
    record = db.scalar(
        select(Dataset)
        .where(Dataset.id == record_id)
        .options(
            selectinload(Dataset.expeditions),
            selectinload(Dataset.research_topics),
        )
    )
    if record is None:
        return None

    facts: list[Fact] = []
    _add(
        facts,
        "Data file",
        f"{record.file_type.upper()} file" if record.file_type else "Metadata only, no data file",
    )
    _add(facts, "Research topics", _names(record.research_topics))
    _add(facts, "Related expeditions", _names(record.expeditions))

    return OutreachSource(
        resource_type=OutreachResourceType.dataset,
        id=record.id,
        title=record.title,
        summary=_clean(record.description),
        verification_status=record.verification_status,
        is_demo_data=record.is_demo_data,
        source_url=record.source_url,
        href=f"/datasets/{record.id}",
        facts=facts,
        topics=_topics(record.research_topics),
        related_resources=_expedition_links(record.expeditions),
    )


def _document(db: Session, record_id: str) -> OutreachSource | None:
    record = db.scalar(
        select(Document)
        .where(Document.id == record_id)
        .options(
            selectinload(Document.publication),
            selectinload(Document.report),
            selectinload(Document.expedition),
        )
    )
    if record is None:
        return None

    # Only catalogue details are used. The stored document text is not read.
    facts: list[Fact] = []
    _add(facts, "Document type", f"{record.file_type.upper()} document")
    _add(facts, "Source type", record.source_type.replace("_", " "))
    _add(facts, "Publication date", record.publication_date and format_date(record.publication_date))
    related = related_document_resources(record)
    for resource in related:
        _add(facts, f"Related {resource.type}", resource.title)

    return OutreachSource(
        resource_type=OutreachResourceType.document,
        id=record.id,
        title=record.title,
        summary=None,
        verification_status=record.verification_status,
        is_demo_data=record.is_demo_data,
        source_url=record.source_url,
        href=f"/documents/{record.id}",
        facts=facts,
        related_resources=related,
    )


def _report(db: Session, record_id: str) -> OutreachSource | None:
    record = db.scalar(
        select(Report)
        .where(Report.id == record_id)
        .options(selectinload(Report.expeditions))
    )
    if record is None:
        return None

    facts: list[Fact] = []
    _add(facts, "Publication date", record.publication_date and format_date(record.publication_date))
    _add(facts, "Related expeditions", _names(record.expeditions))

    return OutreachSource(
        resource_type=OutreachResourceType.report,
        id=record.id,
        title=record.title,
        summary=_clean(record.summary),
        verification_status=record.verification_status,
        is_demo_data=record.is_demo_data,
        source_url=record.source_url,
        # Reports have no page of their own yet.
        href=None,
        facts=facts,
        related_resources=_expedition_links(record.expeditions),
    )


LOADERS = {
    OutreachResourceType.expedition: _expedition,
    OutreachResourceType.publication: _publication,
    OutreachResourceType.dataset: _dataset,
    OutreachResourceType.document: _document,
    OutreachResourceType.report: _report,
}


def load_source(
    db: Session,
    resource_type: OutreachResourceType,
    record_id: str,
) -> OutreachSource | None:
    return LOADERS[resource_type](db, record_id)


def list_sources(db: Session, resource_type: OutreachResourceType, query: str | None):
    """Return (id, title, verification status, demo flag) rows for the selector."""
    model, title_column, text_column = MODELS[resource_type]
    statement = select(
        model.id, title_column, model.verification_status, model.is_demo_data
    ).order_by(title_column)

    text = (query or "").strip().casefold()
    if text:
        escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        matches = [func.lower(title_column).like(pattern, escape="\\")]
        if text_column is not None:
            matches.append(func.lower(text_column).like(pattern, escape="\\"))
        statement = statement.where(or_(*matches))

    return db.execute(statement.limit(SOURCE_LIST_LIMIT)).all()
