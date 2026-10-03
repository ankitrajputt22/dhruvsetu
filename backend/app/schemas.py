from datetime import date

from pydantic import BaseModel, ConfigDict


class ApiSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


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


class ExpeditionDetail(ExpeditionSummary):
    scientists: list[ScientistSummary]
    research_topics: list[ResearchTopicSummary]
    locations: list[LocationSummary]
    publications: list[PublicationSummary]
    reports: list[ReportSummary]
    datasets: list[DatasetSummary]
    media_assets: list[MediaAssetSummary]
