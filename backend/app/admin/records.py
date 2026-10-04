from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.geo import valid_coordinates
from app.models import (
    VERIFICATION_STATUSES,
    Dataset,
    Document,
    Expedition,
    MediaAsset,
    Publication,
    Report,
    ResearchStation,
    User,
    VerificationChange,
)
from app.outreach.sources import load_source
from app.provenance import RELATED_RESOURCE_ROUTES
from app.schemas import OutreachResourceType, RelatedDocumentResource

QUEUE_LIMIT = 200


@dataclass(frozen=True)
class RecordType:
    key: str
    label: str
    model: type
    title_attribute: str


# Every kind of repository record that has a verification status.
RECORD_TYPES = {
    item.key: item
    for item in (
        RecordType("expedition", "Expedition", Expedition, "name"),
        RecordType("publication", "Publication", Publication, "title"),
        RecordType("report", "Report", Report, "title"),
        RecordType("dataset", "Dataset", Dataset, "title"),
        RecordType("document", "Document", Document, "title"),
        RecordType("station", "Research station", ResearchStation, "name"),
        RecordType("media", "Media record", MediaAsset, "title"),
    )
}


class InvalidTransition(Exception):
    """The requested status change is not allowed. The message is safe to show."""


@dataclass(frozen=True)
class RecordSummary:
    record_type: str
    type_label: str
    id: str
    title: str
    verification_status: str
    is_demo_data: bool
    source_url: str | None
    created_at: datetime


@dataclass(frozen=True)
class RecordDetail:
    summary: RecordSummary
    description: str | None
    facts: list[tuple[str, str]]
    related_resources: list[RelatedDocumentResource]
    href: str | None


def is_demo_name(name: str) -> bool:
    # Records without a demo flag are marked as demo data by their name.
    return name.startswith(("Demo ", "Prototype "))


def _summary(record_type: RecordType, record) -> RecordSummary:
    title = getattr(record, record_type.title_attribute)
    demo = getattr(record, "is_demo_data", None)
    return RecordSummary(
        record_type=record_type.key,
        type_label=record_type.label,
        id=record.id,
        title=title,
        verification_status=record.verification_status,
        is_demo_data=is_demo_name(title) if demo is None else bool(demo),
        source_url=getattr(record, "source_url", None),
        created_at=record.created_at,
    )


def count_by_status(db: Session) -> list[dict]:
    rows = []
    for record_type in RECORD_TYPES.values():
        counts = dict(
            db.execute(
                select(record_type.model.verification_status, func.count()).group_by(
                    record_type.model.verification_status
                )
            ).all()
        )
        rows.append(
            {
                "record_type": record_type.key,
                "type_label": record_type.label,
                **{status: counts.get(status, 0) for status in VERIFICATION_STATUSES},
            }
        )
    return rows


def list_records(
    db: Session,
    status: str,
    record_type: str | None,
) -> list[RecordSummary]:
    types = [RECORD_TYPES[record_type]] if record_type else list(RECORD_TYPES.values())
    records: list[RecordSummary] = []
    for item in types:
        found = db.scalars(
            select(item.model).where(item.model.verification_status == status)
        ).all()
        records.extend(_summary(item, record) for record in found)
    records.sort(key=lambda record: (record.type_label, record.title.casefold()))
    return records[:QUEUE_LIMIT]


def get_record(db: Session, record_type: str, record_id: str):
    return db.get(RECORD_TYPES[record_type].model, record_id)


def _station_detail(db: Session, station: ResearchStation) -> RecordDetail:
    station = db.scalar(
        select(ResearchStation)
        .where(ResearchStation.id == station.id)
        .options(selectinload(ResearchStation.location))
    )
    facts: list[tuple[str, str]] = []
    location = station.location
    href = None
    if location is not None:
        facts.append(("Location", location.name))
        if location.region:
            facts.append(("Region", location.region))
        coordinates = valid_coordinates(location.latitude, location.longitude)
        facts.append(
            (
                "Stored coordinates",
                f"{coordinates[0]}, {coordinates[1]}" if coordinates else "Not stored",
            )
        )
        if location.description:
            # For the real stations this note names the coordinate source.
            facts.append(("Location note", location.description))
        href = f"/map?location={location.id}"
    return RecordDetail(
        summary=_summary(RECORD_TYPES["station"], station),
        description=station.description,
        facts=facts,
        related_resources=[],
        href=href,
    )


def _media_detail(db: Session, media: MediaAsset) -> RecordDetail:
    media = db.scalar(
        select(MediaAsset)
        .where(MediaAsset.id == media.id)
        .options(selectinload(MediaAsset.expeditions))
    )
    return RecordDetail(
        summary=_summary(RECORD_TYPES["media"], media),
        description=media.description,
        facts=[("Media type", media.media_type)],
        related_resources=[
            RelatedDocumentResource(
                id=expedition.id,
                type="expedition",
                title=expedition.name,
                href=RELATED_RESOURCE_ROUTES["expedition"].format(id=expedition.id),
            )
            for expedition in sorted(media.expeditions, key=lambda item: item.name)
        ],
        href=None,
    )


def _submitter_facts(record) -> list[tuple[str, str]]:
    """Who submitted a document or a dataset. Shown to admins only."""
    if getattr(record, "submitted_by_user_id", None) is None:
        return []
    submitter = record.submitted_by
    name = submitter.display_name or "No name given"
    return [
        ("Submitted by", f"{name} ({submitter.email})"),
        ("Submitter role now", submitter.role.capitalize()),
        ("Submitted on", record.created_at.strftime("%d %B %Y").lstrip("0")),
    ]


def record_detail(db: Session, record_type: str, record) -> RecordDetail:
    """Everything the repository holds about a record, for the reviewer."""
    if record_type == "station":
        return _station_detail(db, record)
    if record_type == "media":
        return _media_detail(db, record)

    # The other types share the fact list already used for outreach drafts.
    source = load_source(db, OutreachResourceType(record_type), record.id)
    return RecordDetail(
        summary=_summary(RECORD_TYPES[record_type], record),
        description=source.summary,
        facts=[(fact.label, fact.value) for fact in source.facts]
        + _submitter_facts(record),
        related_resources=source.related_resources,
        href=source.href,
    )


def change_status(
    db: Session,
    record_type: str,
    record,
    new_status: str,
    admin: User,
) -> None:
    """Move a record one step forward, or back to any earlier status."""
    current = record.verification_status
    if new_status == current:
        raise InvalidTransition(f"This record is already {new_status.capitalize()}.")
    order = VERIFICATION_STATUSES
    if current in order and order.index(new_status) > order.index(current) + 1:
        raise InvalidTransition("A record must be Reviewed before it can be Verified.")

    record.verification_status = new_status
    db.add(
        VerificationChange(
            record_type=record_type,
            record_id=record.id,
            from_status=current,
            to_status=new_status,
            changed_by_user_id=admin.id,
        )
    )
    db.commit()


def changes_for(db: Session, record_type: str, record_id: str) -> list[VerificationChange]:
    return list(
        db.scalars(
            select(VerificationChange)
            .where(
                VerificationChange.record_type == record_type,
                VerificationChange.record_id == record_id,
            )
            .options(selectinload(VerificationChange.changed_by))
            .order_by(VerificationChange.changed_at.desc(), VerificationChange.id)
            .limit(20)
        ).all()
    )
