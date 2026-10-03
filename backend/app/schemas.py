from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.geo import valid_coordinates


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
    source_url: str | None
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
    latitude: float | None
    longitude: float | None

    @model_validator(mode="after")
    def _drop_unusable_coordinates(self) -> "LocationSummary":
        if valid_coordinates(self.latitude, self.longitude) is None:
            self.latitude = None
            self.longitude = None
        return self


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
    doi: str | None
    source_url: str | None
    summary: str | None
    verification_status: str
    is_demo_data: bool


class ReportSummary(ApiSchema):
    id: str
    title: str
    publication_date: date | None
    source_url: str | None
    summary: str | None
    verification_status: str
    is_demo_data: bool


class DatasetSummary(ApiSchema):
    id: str
    title: str
    description: str | None
    file_type: str | None
    source_url: str | None
    verification_status: str
    is_demo_data: bool


class FilterOption(ApiSchema):
    id: str
    name: str


class DatasetFilters(ApiSchema):
    """Filter values that at least one dataset actually uses."""

    file_types: list[str]
    verification_statuses: list[str]
    research_topics: list[FilterOption]
    expeditions: list[FilterOption]


class DatasetFileInfo(ApiSchema):
    file_name: str
    file_type: str | None
    size_bytes: int | None
    available: bool
    previewable: bool
    preview_message: str | None


class DatasetColumnStatistics(ApiSchema):
    count: int
    minimum: float
    maximum: float
    mean: float


class DatasetColumn(ApiSchema):
    name: str
    type: str
    statistics: DatasetColumnStatistics | None


class DatasetPreview(ApiSchema):
    file_type: str
    columns: list[DatasetColumn]
    rows: list[list[int | float | str | None]]
    row_count: int
    column_count: int
    preview_limit: int
    statistics_row_count: int


class MapStation(ApiSchema):
    id: str
    name: str
    description: str | None
    verification_status: str
    is_demo_data: bool


class MapExpedition(ApiSchema):
    id: str
    name: str
    expedition_number: str | None
    verification_status: str
    is_demo_data: bool


class MapRecord(ApiSchema):
    id: str
    title: str


class MapLocation(ApiSchema):
    id: str
    name: str
    region: str | None
    description: str | None
    latitude: float | None
    longitude: float | None
    # True when the stored coordinates can be drawn on the web map.
    mappable: bool
    location_type: str
    polar_region: str | None
    is_demo_data: bool
    stations: list[MapStation]
    expeditions: list[MapExpedition]
    expedition_count: int
    # Connected through the related expeditions, not directly to the location.
    research_topics: list[FilterOption]
    datasets: list[MapRecord]
    documents: list[MapRecord]


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
    href: str | None = None


class SourceProvenance(ApiSchema):
    """Source details shown wherever a document is used as evidence."""

    title: str
    file_type: str | None
    source_type: str | None
    source_url: str | None
    publication_date: date | None
    verification_status: str | None
    is_demo_data: bool
    related_resources: list[RelatedDocumentResource]


class LinkedDocument(SourceProvenance):
    id: str
    file_type: str
    source_type: str
    verification_status: str


class DocumentSummary(LinkedDocument):
    file_name: str
    chunk_count: int


class DocumentDetail(DocumentSummary):
    created_at: datetime
    first_page: int | None
    last_page: int | None


class DatasetListItem(DatasetSummary):
    created_at: datetime
    has_file: bool
    related_resources: list[RelatedDocumentResource]
    research_topics: list[ResearchTopicSummary]


class DatasetDetail(DatasetListItem):
    file: DatasetFileInfo | None


class DataLabStatus(ApiSchema):
    enabled: bool
    supported_file_types: list[str]
    cell_timeout_seconds: int
    idle_timeout_minutes: int


class DataLabSessionRequest(BaseModel):
    dataset_id: str = Field(max_length=36)


class DataLabStarterCell(ApiSchema):
    title: str
    code: str


class DataLabSession(ApiSchema):
    session_id: str
    dataset_id: str
    dataset_title: str
    file_type: str
    # Where the dataset appears inside the session, never a host path.
    data_path: str
    starter_cells: list[DataLabStarterCell]
    cell_timeout_seconds: int
    idle_timeout_minutes: int
    created_at: datetime


class DataLabExecuteRequest(BaseModel):
    code: str = Field(max_length=20_000)


class DataLabOutput(ApiSchema):
    """One piece of cell output: text, a table, an image or an error."""

    type: Literal["text", "table", "image", "error"]
    # text
    stream: str | None = None
    text: str | None = None
    # table
    columns: list[str] | None = None
    index: list[str] | None = None
    index_name: str | None = None
    rows: list[list[int | float | str | None]] | None = None
    total_rows: int | None = None
    total_columns: int | None = None
    # image
    media_type: str | None = None
    data: str | None = None
    # error
    name: str | None = None
    message: str | None = None
    traceback: str | None = None


class DataLabResult(ApiSchema):
    status: Literal["ok", "error", "timeout", "kernel_died"]
    outputs: list[DataLabOutput]
    truncated: bool
    execution_count: int | None
    state_lost: bool
    duration_ms: int


class AssistantQuestion(BaseModel):
    question: str = Field(max_length=500)


class AssistantSource(SourceProvenance):
    number: int
    document_id: str
    page_number: int | None
    section_name: str | None
    match_reason: str
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
    source_documents: list[LinkedDocument] = []
