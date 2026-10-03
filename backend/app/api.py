from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import (
    Dataset,
    Expedition,
    Publication,
    Report,
    ResearchTopic,
    Scientist,
)
from app.search.semantic import (
    SemanticSearchUnavailable,
    search_semantic_index,
)
from app.schemas import (
    DatasetSummary,
    ExpeditionDetail,
    ExpeditionSummary,
    PublicationSummary,
    ResearchTopicSummary,
    SearchMode,
    SearchResourceType,
    SearchResult,
    ScientistDetail,
    ScientistSummary,
)

router = APIRouter(prefix="/api")
SEARCH_LIMIT_PER_TYPE = 5


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _search_records(
    db: Session,
    *,
    model: type,
    title_column,
    description_column,
    pattern: str,
):
    title_match = func.lower(title_column).like(pattern, escape="\\")
    description_match = func.lower(description_column).like(pattern, escape="\\")
    match_rank = case((title_match, 0), else_=1).label("match_rank")
    statement = (
        select(model, match_rank)
        .where(or_(title_match, description_match))
        .order_by(match_rank, title_column)
        .limit(SEARCH_LIMIT_PER_TYPE)
    )
    return db.execute(statement).all()


def _to_search_results(
    rows,
    *,
    resource_type: SearchResourceType,
    title_attribute: str,
    description_attribute: str,
    href_template: str | None,
) -> list[SearchResult]:
    results = []
    for record, match_rank in rows:
        title = getattr(record, title_attribute)
        is_demo_data = getattr(record, "is_demo_data", None)
        if is_demo_data is None:
            is_demo_data = title.startswith(("Demo ", "Prototype "))

        results.append(
            SearchResult(
                id=record.id,
                type=resource_type,
                title=title,
                description=getattr(record, description_attribute),
                is_demo_data=bool(is_demo_data),
                verification_status=getattr(record, "verification_status", None),
                href=(
                    href_template.format(id=record.id)
                    if href_template is not None
                    else None
                ),
                match_reason=(
                    "Matched title" if match_rank == 0 else "Matched description"
                ),
                search_mode=SearchMode.keyword,
            )
        )
    return results


SEARCH_SOURCES = {
    SearchResourceType.expedition: (
        Expedition,
        Expedition.name,
        Expedition.summary,
        "name",
        "summary",
        "/expeditions/{id}",
    ),
    SearchResourceType.scientist: (
        Scientist,
        Scientist.name,
        Scientist.research_area,
        "name",
        "research_area",
        "/scientists",
    ),
    SearchResourceType.publication: (
        Publication,
        Publication.title,
        Publication.summary,
        "title",
        "summary",
        "/publications",
    ),
    SearchResourceType.dataset: (
        Dataset,
        Dataset.title,
        Dataset.description,
        "title",
        "description",
        "/datasets",
    ),
    SearchResourceType.topic: (
        ResearchTopic,
        ResearchTopic.name,
        ResearchTopic.description,
        "name",
        "description",
        None,
    ),
    SearchResourceType.report: (
        Report,
        Report.title,
        Report.summary,
        "title",
        "summary",
        None,
    ),
}


def _semantic_results(
    db: Session,
    *,
    query: str,
    resource_type: SearchResourceType | None,
) -> list[SearchResult]:
    matches = search_semantic_index(query, resource_type=resource_type)
    results = []
    for match in matches:
        (
            model,
            _,
            _,
            title_attribute,
            description_attribute,
            href_template,
        ) = SEARCH_SOURCES[match.resource_type]
        record = db.get(model, match.record_id)
        if record is None:
            continue

        title = getattr(record, title_attribute)
        is_demo_data = getattr(record, "is_demo_data", None)
        if is_demo_data is None:
            is_demo_data = title.startswith(("Demo ", "Prototype "))

        results.append(
            SearchResult(
                id=record.id,
                type=match.resource_type,
                title=title,
                description=getattr(record, description_attribute),
                is_demo_data=bool(is_demo_data),
                verification_status=getattr(record, "verification_status", None),
                href=(
                    href_template.format(id=record.id)
                    if href_template is not None
                    else None
                ),
                match_reason="Related to your search",
                search_mode=SearchMode.semantic,
            )
        )
    return results


@router.get("/search", response_model=list[SearchResult])
def search(
    q: Annotated[str, Query(max_length=100)],
    resource_type: Annotated[
        SearchResourceType | None, Query(alias="type")
    ] = None,
    mode: Annotated[SearchMode, Query()] = SearchMode.keyword,
    db: Session = Depends(get_db),
) -> list[SearchResult]:
    query = q.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Search query cannot be empty",
        )

    if mode == SearchMode.semantic:
        try:
            return _semantic_results(
                db,
                query=query,
                resource_type=resource_type,
            )
        except SemanticSearchUnavailable as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Semantic search is not ready right now. "
                    "You can still use keyword search."
                ),
            ) from error

    pattern = f"%{_escape_like(query.casefold())}%"
    requested_types = (
        (resource_type,)
        if resource_type is not None
        else tuple(SearchResourceType)
    )

    results = []
    for current_type in requested_types:
        (
            model,
            title_column,
            description_column,
            title_attribute,
            description_attribute,
            href_template,
        ) = SEARCH_SOURCES[current_type]
        rows = _search_records(
            db,
            model=model,
            title_column=title_column,
            description_column=description_column,
            pattern=pattern,
        )
        results.extend(
            _to_search_results(
                rows,
                resource_type=current_type,
                title_attribute=title_attribute,
                description_attribute=description_attribute,
                href_template=href_template,
            )
        )

    return results


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
