from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Dataset, Expedition, Publication, ResearchTopic, Scientist
from app.schemas import (
    DatasetSummary,
    ExpeditionDetail,
    ExpeditionSummary,
    PublicationSummary,
    ResearchTopicSummary,
    ScientistDetail,
    ScientistSummary,
)

router = APIRouter(prefix="/api")


@router.get("/expeditions", response_model=list[ExpeditionSummary])
def list_expeditions(db: Session = Depends(get_db)) -> list[ExpeditionSummary]:
    expeditions = db.scalars(select(Expedition).order_by(Expedition.name)).all()
    return [ExpeditionSummary.model_validate(item) for item in expeditions]


@router.get("/expeditions/{expedition_id}", response_model=ExpeditionDetail)
def get_expedition(
    expedition_id: str, db: Session = Depends(get_db)
) -> ExpeditionDetail:
    expedition = db.scalar(
        select(Expedition)
        .where(Expedition.id == expedition_id)
        .options(
            selectinload(Expedition.scientists).selectinload(Scientist.institution),
            selectinload(Expedition.research_topics),
            selectinload(Expedition.locations),
            selectinload(Expedition.publications),
            selectinload(Expedition.reports),
            selectinload(Expedition.datasets),
            selectinload(Expedition.media_assets),
        )
    )
    if expedition is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expedition not found",
        )
    return ExpeditionDetail.model_validate(expedition)


@router.get("/scientists", response_model=list[ScientistSummary])
def list_scientists(db: Session = Depends(get_db)) -> list[ScientistSummary]:
    statement = (
        select(Scientist)
        .options(selectinload(Scientist.institution))
        .order_by(Scientist.name)
    )
    scientists = db.scalars(statement).all()
    return [ScientistSummary.model_validate(item) for item in scientists]


@router.get("/scientists/{scientist_id}", response_model=ScientistDetail)
def get_scientist(
    scientist_id: str, db: Session = Depends(get_db)
) -> ScientistDetail:
    scientist = db.scalar(
        select(Scientist)
        .where(Scientist.id == scientist_id)
        .options(selectinload(Scientist.institution))
    )
    if scientist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scientist not found",
        )
    return ScientistDetail.model_validate(scientist)


@router.get("/publications", response_model=list[PublicationSummary])
def list_publications(db: Session = Depends(get_db)) -> list[PublicationSummary]:
    publications = db.scalars(
        select(Publication).order_by(Publication.title)
    ).all()
    return [PublicationSummary.model_validate(item) for item in publications]


@router.get("/datasets", response_model=list[DatasetSummary])
def list_datasets(db: Session = Depends(get_db)) -> list[DatasetSummary]:
    datasets = db.scalars(select(Dataset).order_by(Dataset.title)).all()
    return [DatasetSummary.model_validate(item) for item in datasets]


@router.get("/topics", response_model=list[ResearchTopicSummary])
def list_topics(db: Session = Depends(get_db)) -> list[ResearchTopicSummary]:
    topics = db.scalars(select(ResearchTopic).order_by(ResearchTopic.name)).all()
    return [ResearchTopicSummary.model_validate(item) for item in topics]
