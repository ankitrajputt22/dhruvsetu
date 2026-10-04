from dataclasses import asdict
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.assistant.service import (
    AssistantNotConfigured,
    AssistantProviderError,
    AssistantRateLimited,
    AssistantRetrievalError,
    AssistantTimeout,
    answer_question,
)
from app.database import get_db
from app.datasets.files import find_dataset_file
from app.datasets.preview import (
    PreviewMalformed,
    PreviewTooLarge,
    PreviewUnsupported,
    build_preview,
    preview_unavailable_reason,
)
from app.geo import fits_web_map, polar_region, valid_coordinates
from app.models import (
    VERIFICATION_STATUSES,
    Dataset,
    Document,
    DocumentChunk,
    Expedition,
    Location,
    Publication,
    Report,
    ResearchTopic,
    Scientist,
)
from app.provenance import RELATED_RESOURCE_ROUTES, related_document_resources
from app.search.semantic import (
    SemanticSearchUnavailable,
    search_semantic_index,
)
from app.schemas import (
    AssistantAnswer,
    AssistantQuestion,
    AssistantSource,
    DatasetDetail,
    DatasetFileInfo,
    DatasetFilters,
    DatasetListItem,
    DatasetPreview,
    DatasetSummary,
    DocumentDetail,
    DocumentSummary,
    ExpeditionDetail,
    ExpeditionSummary,
    FilterOption,
    LinkedDocument,
    MapExpedition,
    MapLocation,
    MapRecord,
    MapStation,
    PublicationSummary,
    RelatedDocumentResource,
    ResearchTopicSummary,
    SearchMode,
    SearchResourceType,
    SearchResult,
    ScientistDetail,
    ScientistSummary,
)

router = APIRouter(prefix="/api")
SEARCH_LIMIT_PER_TYPE = 5


DOCUMENT_RELATIONSHIPS = (
    selectinload(Document.publication),
    selectinload(Document.report),
    selectinload(Document.expedition),
)


def _linked_document(document: Document) -> LinkedDocument:
    return LinkedDocument(
        id=document.id,
        title=document.title,
        file_type=document.file_type,
        source_type=document.source_type,
        source_url=document.source_url,
        publication_date=document.publication_date,
        verification_status=document.verification_status,
        is_demo_data=document.is_demo_data,
        related_resources=related_document_resources(document),
    )


def _submitter_name(record: Document | Dataset) -> str | None:
    # Only the display name is public. The email and the account ID are not.
    submitter = record.submitted_by
    return submitter.display_name if submitter is not None else None


def _document_summary(document: Document, chunk_count: int) -> DocumentSummary:
    return DocumentSummary(
        **_linked_document(document).model_dump(),
        file_name=document.file_name,
        chunk_count=chunk_count,
    )


def _match_reason(number: int) -> str:
    # Plain wording only. The similarity score stays inside the backend.
    if number == 1:
        return "Closest match to your question"
    return "Also related to your question"


def _is_demo_name(name: str) -> bool:
    # Records without a demo flag are marked as demo data by their name.
    return name.startswith(("Demo ", "Prototype "))


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
            is_demo_data = _is_demo_name(title)

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
                source_url=getattr(record, "source_url", None),
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
        "/datasets/{id}",
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
            is_demo_data = _is_demo_name(title)

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
                source_url=getattr(record, "source_url", None),
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


@router.post("/assistant/ask", response_model=AssistantAnswer)
def ask_assistant(
    payload: AssistantQuestion,
    db: Session = Depends(get_db),
) -> AssistantAnswer:
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Question cannot be empty",
        )

    try:
        result = answer_question(db, question)
    except AssistantNotConfigured as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant is not configured.",
        ) from error
    except AssistantRetrievalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Source search is not ready right now. Please try again later.",
        ) from error
    except AssistantTimeout as error:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI assistant took too long to answer. Please try again.",
        ) from error
    except AssistantRateLimited as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI assistant is busy right now. Please try again in a few minutes.",
        ) from error
    except AssistantProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI assistant could not answer right now. Please try again.",
        ) from error

    return AssistantAnswer(
        answer=result.answer,
        sources=[
            AssistantSource(
                number=number,
                document_id=source.document_id,
                title=source.document_title,
                file_type=source.file_type,
                source_type=source.source_type,
                source_url=source.source_url,
                publication_date=source.publication_date,
                verification_status=source.verification_status,
                is_demo_data=source.is_demo_data,
                related_resources=list(source.related_resources),
                page_number=source.page_number,
                section_name=source.section_name,
                match_reason=_match_reason(number),
                href=f"/documents/{source.document_id}",
            )
            for number, source in enumerate(result.sources, start=1)
        ],
    )


@router.get("/expeditions", response_model=list[ExpeditionSummary])
def list_expeditions(db: Session = Depends(get_db)) -> list[ExpeditionSummary]:
    expeditions = db.scalars(select(Expedition).order_by(Expedition.name)).all()
    return [ExpeditionSummary.model_validate(item) for item in expeditions]


@router.get("/documents", response_model=list[DocumentSummary])
def list_documents(db: Session = Depends(get_db)) -> list[DocumentSummary]:
    chunk_count = (
        select(func.count(DocumentChunk.id))
        .where(DocumentChunk.document_id == Document.id)
        .correlate(Document)
        .scalar_subquery()
    )
    rows = db.execute(
        select(Document, chunk_count.label("chunk_count"))
        .options(*DOCUMENT_RELATIONSHIPS)
        .order_by(Document.title)
    ).all()
    return [_document_summary(document, count) for document, count in rows]


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
) -> DocumentDetail:
    document = db.scalar(
        select(Document)
        .where(Document.id == document_id)
        .options(*DOCUMENT_RELATIONSHIPS)
    )
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    chunk_count, first_page, last_page = db.execute(
        select(
            func.count(DocumentChunk.id),
            func.min(DocumentChunk.page_number),
            func.max(DocumentChunk.page_number),
        ).where(DocumentChunk.document_id == document.id)
    ).one()
    summary = _document_summary(document, chunk_count)
    return DocumentDetail(
        **summary.model_dump(),
        created_at=document.created_at,
        first_page=first_page,
        last_page=last_page,
        submitted_by=_submitter_name(document),
    )


def _expedition_document_links(expeditions: list[Expedition]):
    """Match documents linked to these expeditions, or to their publications or reports."""
    expedition_ids = [item.id for item in expeditions]
    publication_ids = [pub.id for item in expeditions for pub in item.publications]
    report_ids = [report.id for item in expeditions for report in item.reports]
    links = [Document.expedition_id.in_(expedition_ids)]
    if publication_ids:
        links.append(Document.publication_id.in_(publication_ids))
    if report_ids:
        links.append(Document.report_id.in_(report_ids))
    return or_(*links)


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

    documents = db.scalars(
        select(Document)
        .where(_expedition_document_links([expedition]))
        .options(*DOCUMENT_RELATIONSHIPS)
        .order_by(Document.title)
    ).all()

    detail = ExpeditionDetail.model_validate(expedition)
    detail.source_documents = [_linked_document(item) for item in documents]
    return detail


def _map_location(location: Location, documents: list[Document]) -> MapLocation:
    coordinates = valid_coordinates(location.latitude, location.longitude)
    latitude, longitude = coordinates if coordinates else (None, None)
    expeditions = sorted(location.expeditions, key=lambda item: item.name)

    if location.research_stations:
        location_type = "station"
    elif expeditions:
        location_type = "expedition_location"
    else:
        location_type = "other"

    topics = {
        topic.id: topic for item in expeditions for topic in item.research_topics
    }
    datasets = {
        dataset.id: dataset for item in expeditions for dataset in item.datasets
    }
    expedition_ids = {item.id for item in expeditions}
    publication_ids = {pub.id for item in expeditions for pub in item.publications}
    report_ids = {report.id for item in expeditions for report in item.reports}

    return MapLocation(
        id=location.id,
        name=location.name,
        region=location.region,
        description=location.description,
        latitude=latitude,
        longitude=longitude,
        mappable=fits_web_map(latitude),
        location_type=location_type,
        polar_region=polar_region(latitude),
        is_demo_data=_is_demo_name(location.name),
        stations=[
            MapStation(
                id=station.id,
                name=station.name,
                description=station.description,
                verification_status=station.verification_status,
                is_demo_data=_is_demo_name(station.name),
            )
            for station in sorted(location.research_stations, key=lambda item: item.name)
        ],
        expeditions=[MapExpedition.model_validate(item) for item in expeditions],
        expedition_count=len(expeditions),
        research_topics=[
            FilterOption(id=topic.id, name=topic.name)
            for topic in sorted(topics.values(), key=lambda item: item.name)
        ],
        datasets=[
            MapRecord(id=dataset.id, title=dataset.title)
            for dataset in sorted(datasets.values(), key=lambda item: item.title)
        ],
        documents=[
            MapRecord(id=document.id, title=document.title)
            for document in documents
            if document.expedition_id in expedition_ids
            or document.publication_id in publication_ids
            or document.report_id in report_ids
        ],
    )


@router.get("/map", response_model=list[MapLocation])
def list_map_locations(db: Session = Depends(get_db)) -> list[MapLocation]:
    locations = db.scalars(
        select(Location)
        .options(
            selectinload(Location.research_stations),
            selectinload(Location.expeditions).options(
                selectinload(Expedition.research_topics),
                selectinload(Expedition.datasets),
                selectinload(Expedition.publications),
                selectinload(Expedition.reports),
            ),
        )
        .order_by(Location.name)
    ).all()

    expeditions = list(
        {item.id: item for location in locations for item in location.expeditions}.values()
    )
    documents = (
        db.scalars(
            select(Document)
            .where(_expedition_document_links(expeditions))
            .order_by(Document.title)
        ).all()
        if expeditions
        else []
    )
    return [_map_location(location, documents) for location in locations]


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


DATASET_RELATIONSHIPS = (
    selectinload(Dataset.expeditions),
    selectinload(Dataset.research_topics),
)


def _dataset_list_item(dataset: Dataset) -> DatasetListItem:
    return DatasetListItem(
        **DatasetSummary.model_validate(dataset).model_dump(),
        created_at=dataset.created_at,
        has_file=find_dataset_file(dataset) is not None,
        related_resources=[
            RelatedDocumentResource(
                id=expedition.id,
                type="expedition",
                title=expedition.name,
                href=RELATED_RESOURCE_ROUTES["expedition"].format(id=expedition.id),
            )
            for expedition in sorted(dataset.expeditions, key=lambda item: item.name)
        ],
        research_topics=[
            ResearchTopicSummary.model_validate(topic)
            for topic in sorted(dataset.research_topics, key=lambda item: item.name)
        ],
    )


def _dataset_file_info(dataset: Dataset) -> DatasetFileInfo | None:
    if not dataset.file_name:
        return None

    stored = find_dataset_file(dataset)
    if stored is None:
        return DatasetFileInfo(
            file_name=dataset.file_name,
            file_type=dataset.file_type,
            size_bytes=None,
            available=False,
            previewable=False,
            preview_message="The file for this dataset could not be found.",
        )

    reason = preview_unavailable_reason(stored)
    return DatasetFileInfo(
        file_name=stored.file_name,
        file_type=stored.file_type,
        size_bytes=stored.size_bytes,
        available=True,
        previewable=reason is None,
        preview_message=reason,
    )


def _get_dataset(db: Session, dataset_id: str) -> Dataset:
    dataset = db.scalar(
        select(Dataset)
        .where(Dataset.id == dataset_id)
        .options(*DATASET_RELATIONSHIPS)
    )
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    return dataset


def _get_dataset_file(db: Session, dataset_id: str):
    dataset = _get_dataset(db, dataset_id)
    if not dataset.file_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This dataset has no attached file.",
        )
    stored = find_dataset_file(dataset)
    if stored is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The file for this dataset could not be found.",
        )
    return stored


@router.get("/datasets", response_model=list[DatasetListItem])
def list_datasets(
    q: Annotated[str | None, Query(max_length=100)] = None,
    topic: Annotated[str | None, Query(max_length=36)] = None,
    expedition: Annotated[str | None, Query(max_length=36)] = None,
    file_type: Annotated[str | None, Query(max_length=50)] = None,
    verification_status: Annotated[
        Literal["uploaded", "reviewed", "verified"] | None, Query()
    ] = None,
    db: Session = Depends(get_db),
) -> list[DatasetListItem]:
    statement = (
        select(Dataset).options(*DATASET_RELATIONSHIPS).order_by(Dataset.title)
    )
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip().casefold())}%"
        statement = statement.where(
            or_(
                func.lower(Dataset.title).like(pattern, escape="\\"),
                func.lower(Dataset.description).like(pattern, escape="\\"),
            )
        )
    if topic:
        statement = statement.where(
            Dataset.research_topics.any(ResearchTopic.id == topic)
        )
    if expedition:
        statement = statement.where(Dataset.expeditions.any(Expedition.id == expedition))
    if file_type:
        statement = statement.where(
            func.lower(Dataset.file_type) == file_type.strip().casefold()
        )
    if verification_status:
        statement = statement.where(
            Dataset.verification_status == verification_status
        )

    return [_dataset_list_item(item) for item in db.scalars(statement).all()]


@router.get("/datasets/filters", response_model=DatasetFilters)
def get_dataset_filters(db: Session = Depends(get_db)) -> DatasetFilters:
    file_types = db.scalars(
        select(func.lower(Dataset.file_type))
        .where(Dataset.file_type.is_not(None))
        .distinct()
    ).all()
    used_statuses = set(
        db.scalars(select(Dataset.verification_status).distinct()).all()
    )
    topics = db.scalars(
        select(ResearchTopic)
        .where(ResearchTopic.datasets.any())
        .order_by(ResearchTopic.name)
    ).all()
    expeditions = db.scalars(
        select(Expedition).where(Expedition.datasets.any()).order_by(Expedition.name)
    ).all()

    return DatasetFilters(
        file_types=sorted(file_types),
        verification_statuses=[
            item for item in VERIFICATION_STATUSES if item in used_statuses
        ],
        research_topics=[FilterOption(id=item.id, name=item.name) for item in topics],
        expeditions=[FilterOption(id=item.id, name=item.name) for item in expeditions],
    )


@router.get("/datasets/{dataset_id}", response_model=DatasetDetail)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)) -> DatasetDetail:
    dataset = _get_dataset(db, dataset_id)
    return DatasetDetail(
        **_dataset_list_item(dataset).model_dump(),
        file=_dataset_file_info(dataset),
        submitted_by=_submitter_name(dataset),
    )


@router.get("/datasets/{dataset_id}/preview", response_model=DatasetPreview)
def preview_dataset(dataset_id: str, db: Session = Depends(get_db)) -> DatasetPreview:
    stored = _get_dataset_file(db, dataset_id)
    try:
        preview = build_preview(stored)
    except PreviewUnsupported as error:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(error),
        ) from error
    except PreviewTooLarge as error:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=str(error),
        ) from error
    except PreviewMalformed as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error
    return DatasetPreview.model_validate(asdict(preview))


@router.get("/datasets/{dataset_id}/download")
def download_dataset(dataset_id: str, db: Session = Depends(get_db)) -> FileResponse:
    stored = _get_dataset_file(db, dataset_id)
    # Always sent as a plain download so the browser never opens or runs it.
    return FileResponse(
        stored.path,
        media_type="application/octet-stream",
        filename=stored.file_name,
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.get("/topics", response_model=list[ResearchTopicSummary])
def list_topics(db: Session = Depends(get_db)) -> list[ResearchTopicSummary]:
    topics = db.scalars(select(ResearchTopic).order_by(ResearchTopic.name)).all()
    return [ResearchTopicSummary.model_validate(item) for item in topics]
