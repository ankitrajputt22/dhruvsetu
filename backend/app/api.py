from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.assistant.service import (
    AssistantNotConfigured,
    AssistantProviderError,
    AssistantRetrievalError,
    AssistantTimeout,
    answer_question,
)
from app.database import get_db
from app.models import (
    Dataset,
    Document,
    DocumentChunk,
    Expedition,
    Publication,
    Report,
    ResearchTopic,
    Scientist,
)
from app.provenance import related_document_resources
from app.search.semantic import (
    SemanticSearchUnavailable,
    search_semantic_index,
)
from app.schemas import (
    AssistantAnswer,
    AssistantQuestion,
    AssistantSource,
    DatasetSummary,
    DocumentDetail,
    DocumentSummary,
    ExpeditionDetail,
    ExpeditionSummary,
    LinkedDocument,
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
    )


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

    # Documents linked to the expedition itself or to one of its publications
    # or reports.
    links = [Document.expedition_id == expedition.id]
    publication_ids = [item.id for item in expedition.publications]
    report_ids = [item.id for item in expedition.reports]
    if publication_ids:
        links.append(Document.publication_id.in_(publication_ids))
    if report_ids:
        links.append(Document.report_id.in_(report_ids))
    documents = db.scalars(
        select(Document)
        .where(or_(*links))
        .options(*DOCUMENT_RELATIONSHIPS)
        .order_by(Document.title)
    ).all()

    detail = ExpeditionDetail.model_validate(expedition)
    detail.source_documents = [_linked_document(item) for item in documents]
    return detail


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
