from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.outreach.sources import OutreachSource, list_sources, load_source
from app.outreach.templates import get_generator, warnings_for
from app.schemas import (
    OutreachDraft,
    OutreachFact,
    OutreachMedia,
    OutreachRequest,
    OutreachResourceType,
    OutreachResult,
    OutreachSection,
    OutreachSourceDetail,
    OutreachSourceOption,
    OutreachTopic,
    OutreachWarning,
)

router = APIRouter(prefix="/api/outreach")


def _source_detail(source: OutreachSource) -> OutreachSourceDetail:
    return OutreachSourceDetail(
        resource_type=source.resource_type,
        type_label=source.type_label,
        id=source.id,
        title=source.title,
        summary=source.summary,
        verification_status=source.verification_status,
        is_demo_data=source.is_demo_data,
        source_url=source.source_url,
        href=source.href,
        facts=[OutreachFact(label=fact.label, value=fact.value) for fact in source.facts],
        topics=[
            OutreachTopic(name=topic.name, description=topic.description)
            for topic in source.topics
        ],
        related_resources=source.related_resources,
        media=[
            OutreachMedia(title=item.title, media_type=item.media_type)
            for item in source.media
        ],
        warnings=[
            OutreachWarning(code=warning.code, message=warning.message)
            for warning in warnings_for(source)
        ],
    )


def _load(db: Session, resource_type: OutreachResourceType, resource_id: str) -> OutreachSource:
    source = load_source(db, resource_type, resource_id)
    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This repository item was not found.",
        )
    return source


@router.get("/sources", response_model=list[OutreachSourceOption])
def get_sources(
    resource_type: Annotated[OutreachResourceType, Query(alias="type")],
    q: Annotated[str | None, Query(max_length=100)] = None,
    db: Session = Depends(get_db),
) -> list[OutreachSourceOption]:
    return [
        OutreachSourceOption(
            resource_type=resource_type,
            id=record_id,
            title=title,
            verification_status=verification_status,
            is_demo_data=is_demo_data,
        )
        for record_id, title, verification_status, is_demo_data in list_sources(
            db, resource_type, q
        )
    ]


@router.get(
    "/sources/{resource_type}/{resource_id}",
    response_model=OutreachSourceDetail,
)
def get_source(
    resource_type: OutreachResourceType,
    resource_id: str,
    db: Session = Depends(get_db),
) -> OutreachSourceDetail:
    return _source_detail(_load(db, resource_type, resource_id))


@router.post("/generate", response_model=OutreachResult)
def generate(payload: OutreachRequest, db: Session = Depends(get_db)) -> OutreachResult:
    source = _load(db, payload.resource_type, payload.resource_id)
    generator = get_generator()
    draft = generator.generate(source, payload.audience, payload.format)
    detail = _source_detail(source)

    return OutreachResult(
        generator=generator.name,
        draft=OutreachDraft(
            audience=payload.audience,
            format=payload.format,
            title=draft.title,
            sections=[
                OutreachSection(heading=section.heading, body=section.body)
                for section in draft.sections
            ],
            text=draft.text,
        ),
        source=detail,
        warnings=detail.warnings,
    )
