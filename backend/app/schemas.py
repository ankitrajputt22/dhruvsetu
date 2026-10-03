from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ApiSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SearchResourceType(StrEnum):
    expedition = "expedition"
    scientist = "scientist"
    publication = "publication"
    dataset = "dataset"
    topic = "topic"
    report = "report"


class SearchMode(StrEnum):
    keyword = "keyword"
    semantic = "semantic"


class SearchResult(ApiSchema):
    id: str
    type: SearchResourceType
    title: str
    description: str | None
    is_demo_data: bool
    verification_status: str | None
    href: str | None
    match_reason: str
    search_mode: SearchMode


class InstitutionSummary(ApiSchema):
    id: str
    name: str


class ScientistSummary(ApiSchema):
    id: str
    name: str
    research_area: str | None
    institution: InstitutionSummary | None


class ScientistDetail(ScientistSummary):
    short_bio: str | None


class ResearchTopicSummary(ApiSchema):
    id: str
    name: str
    description: str | None


class LocationSummary(ApiSchema):
    id: str
    name: str
    region: str | None


class ExpeditionSummary(ApiSchema):
    id: str
    name: str
    expedition_number: str | None
    summary: str | None
    start_date: date | None
    end_date: date | None
    verification_status: str
    is_demo_data: bool


class PublicationSummary(ApiSchema):
    id: str
    title: str
    publication_year: int | None
    summary: str | None
    verification_status: str
    is_demo_data: bool


class ReportSummary(ApiSchema):
    id: str
    title: str
    publication_date: date | None
    summary: str | None
    verification_status: str
    is_demo_data: bool


class DatasetSummary(ApiSchema):
    id: str
    title: str
    description: str | None
    file_type: str | None
    verification_status: str
    is_demo_data: bool


class MediaAssetSummary(ApiSchema):
    id: str
    title: str
    media_type: str
    description: str | None
    verification_status: str
    is_demo_data: bool


class RelatedDocumentResource(ApiSchema):
    id: str
    type: str
    title: str


class DocumentSummary(ApiSchema):
    id: str
    title: str
    file_name: str
    file_type: str
    source_type: str
    publication_date: date | None
    verification_status: str
    is_demo_data: bool
    chunk_count: int


class DocumentDetail(DocumentSummary):
    source_url: str | None
    related_resources: list[RelatedDocumentResource]


class AssistantQuestion(BaseModel):
    question: str = Field(max_length=500)


class AssistantSource(ApiSchema):
    number: int
    document_id: str
    title: str
    file_type: str | None
    source_type: str | None
    page_number: int | None
    source_url: str | None
    verification_status: str | None
    is_demo_data: bool
    href: str


class AssistantAnswer(ApiSchema):
    answer: str
    sources: list[AssistantSource]


class ExpeditionDetail(ExpeditionSummary):
    scientists: list[ScientistSummary]
    research_topics: list[ResearchTopicSummary]
    locations: list[LocationSummary]
    publications: list[PublicationSummary]
    reports: list[ReportSummary]
    datasets: list[DatasetSummary]
    media_assets: list[MediaAssetSummary]
