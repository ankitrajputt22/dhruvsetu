from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    CHAR,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


# uploaded = added but not reviewed, reviewed = checked by a human,
# verified = source details and content confirmed for the prototype.
VERIFICATION_STATUSES = ("uploaded", "reviewed", "verified")


def new_uuid() -> str:
    return str(uuid4())


class UUIDMixin:
    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class VerificationMixin:
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="uploaded", server_default="uploaded"
    )


class DemoDataMixin:
    is_demo_data: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )


expedition_scientists = Table(
    "expedition_scientists",
    Base.metadata,
    Column(
        "expedition_id",
        CHAR(36),
        ForeignKey("expeditions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "scientist_id",
        CHAR(36),
        ForeignKey("scientists.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

expedition_research_topics = Table(
    "expedition_research_topics",
    Base.metadata,
    Column(
        "expedition_id",
        CHAR(36),
        ForeignKey("expeditions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "research_topic_id",
        CHAR(36),
        ForeignKey("research_topics.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

expedition_locations = Table(
    "expedition_locations",
    Base.metadata,
    Column(
        "expedition_id",
        CHAR(36),
        ForeignKey("expeditions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "location_id",
        CHAR(36),
        ForeignKey("locations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

publication_scientists = Table(
    "publication_scientists",
    Base.metadata,
    Column(
        "publication_id",
        CHAR(36),
        ForeignKey("publications.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "scientist_id",
        CHAR(36),
        ForeignKey("scientists.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

publication_expeditions = Table(
    "publication_expeditions",
    Base.metadata,
    Column(
        "publication_id",
        CHAR(36),
        ForeignKey("publications.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "expedition_id",
        CHAR(36),
        ForeignKey("expeditions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

publication_research_topics = Table(
    "publication_research_topics",
    Base.metadata,
    Column(
        "publication_id",
        CHAR(36),
        ForeignKey("publications.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "research_topic_id",
        CHAR(36),
        ForeignKey("research_topics.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

dataset_expeditions = Table(
    "dataset_expeditions",
    Base.metadata,
    Column(
        "dataset_id",
        CHAR(36),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "expedition_id",
        CHAR(36),
        ForeignKey("expeditions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

dataset_research_topics = Table(
    "dataset_research_topics",
    Base.metadata,
    Column(
        "dataset_id",
        CHAR(36),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "research_topic_id",
        CHAR(36),
        ForeignKey("research_topics.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

report_expeditions = Table(
    "report_expeditions",
    Base.metadata,
    Column(
        "report_id",
        CHAR(36),
        ForeignKey("reports.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "expedition_id",
        CHAR(36),
        ForeignKey("expeditions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

media_asset_expeditions = Table(
    "media_asset_expeditions",
    Base.metadata,
    Column(
        "media_asset_id",
        CHAR(36),
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "expedition_id",
        CHAR(36),
        ForeignKey("expeditions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Institution(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "institutions"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(2048))

    scientists: Mapped[list[Scientist]] = relationship(back_populates="institution")


class Scientist(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "scientists"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    institution_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("institutions.id", ondelete="SET NULL")
    )
    research_area: Mapped[str | None] = mapped_column(String(255))
    short_bio: Mapped[str | None] = mapped_column(Text)

    institution: Mapped[Institution | None] = relationship(back_populates="scientists")
    expeditions: Mapped[list[Expedition]] = relationship(
        secondary=expedition_scientists, back_populates="scientists"
    )
    publications: Mapped[list[Publication]] = relationship(
        secondary=publication_scientists, back_populates="scientists"
    )


class Expedition(UUIDMixin, VerificationMixin, DemoDataMixin, TimestampMixin, Base):
    __tablename__ = "expeditions"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    expedition_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    summary: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)

    scientists: Mapped[list[Scientist]] = relationship(
        secondary=expedition_scientists, back_populates="expeditions"
    )
    research_topics: Mapped[list[ResearchTopic]] = relationship(
        secondary=expedition_research_topics, back_populates="expeditions"
    )
    locations: Mapped[list[Location]] = relationship(
        secondary=expedition_locations, back_populates="expeditions"
    )
    publications: Mapped[list[Publication]] = relationship(
        secondary=publication_expeditions, back_populates="expeditions"
    )
    datasets: Mapped[list[Dataset]] = relationship(
        secondary=dataset_expeditions, back_populates="expeditions"
    )
    reports: Mapped[list[Report]] = relationship(
        secondary=report_expeditions, back_populates="expeditions"
    )
    media_assets: Mapped[list[MediaAsset]] = relationship(
        secondary=media_asset_expeditions, back_populates="expeditions"
    )
    documents: Mapped[list[Document]] = relationship(back_populates="expedition")


class Location(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(11, 7))
    description: Mapped[str | None] = mapped_column(Text)

    research_stations: Mapped[list[ResearchStation]] = relationship(
        back_populates="location"
    )
    expeditions: Mapped[list[Expedition]] = relationship(
        secondary=expedition_locations, back_populates="locations"
    )


class ResearchStation(UUIDMixin, VerificationMixin, TimestampMixin, Base):
    __tablename__ = "research_stations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("locations.id", ondelete="SET NULL")
    )
    description: Mapped[str | None] = mapped_column(Text)

    location: Mapped[Location | None] = relationship(back_populates="research_stations")


class ResearchTopic(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "research_topics"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)

    expeditions: Mapped[list[Expedition]] = relationship(
        secondary=expedition_research_topics, back_populates="research_topics"
    )
    publications: Mapped[list[Publication]] = relationship(
        secondary=publication_research_topics, back_populates="research_topics"
    )
    datasets: Mapped[list[Dataset]] = relationship(
        secondary=dataset_research_topics, back_populates="research_topics"
    )


class Publication(UUIDMixin, VerificationMixin, DemoDataMixin, TimestampMixin, Base):
    __tablename__ = "publications"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    publication_year: Mapped[int | None] = mapped_column(Integer)
    doi: Mapped[str | None] = mapped_column(String(255), unique=True)
    source_url: Mapped[str | None] = mapped_column(String(2048))
    summary: Mapped[str | None] = mapped_column(Text)

    scientists: Mapped[list[Scientist]] = relationship(
        secondary=publication_scientists, back_populates="publications"
    )
    expeditions: Mapped[list[Expedition]] = relationship(
        secondary=publication_expeditions, back_populates="publications"
    )
    research_topics: Mapped[list[ResearchTopic]] = relationship(
        secondary=publication_research_topics, back_populates="publications"
    )
    documents: Mapped[list[Document]] = relationship(back_populates="publication")


class Report(UUIDMixin, VerificationMixin, DemoDataMixin, TimestampMixin, Base):
    __tablename__ = "reports"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    publication_date: Mapped[date | None] = mapped_column(Date)
    source_url: Mapped[str | None] = mapped_column(String(2048))
    summary: Mapped[str | None] = mapped_column(Text)

    expeditions: Mapped[list[Expedition]] = relationship(
        secondary=report_expeditions, back_populates="reports"
    )
    documents: Mapped[list[Document]] = relationship(back_populates="report")


class Dataset(UUIDMixin, VerificationMixin, DemoDataMixin, TimestampMixin, Base):
    __tablename__ = "datasets"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    file_type: Mapped[str | None] = mapped_column(String(50))
    source_url: Mapped[str | None] = mapped_column(String(2048))

    expeditions: Mapped[list[Expedition]] = relationship(
        secondary=dataset_expeditions, back_populates="datasets"
    )
    research_topics: Mapped[list[ResearchTopic]] = relationship(
        secondary=dataset_research_topics, back_populates="datasets"
    )


class MediaAsset(UUIDMixin, VerificationMixin, DemoDataMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    media_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(2048))

    expeditions: Mapped[list[Expedition]] = relationship(
        secondary=media_asset_expeditions, back_populates="media_assets"
    )


class Document(UUIDMixin, VerificationMixin, DemoDataMixin, TimestampMixin, Base):
    __tablename__ = "documents"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    source_url: Mapped[str | None] = mapped_column(String(2048))
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    publication_date: Mapped[date | None] = mapped_column(Date)
    publication_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("publications.id", ondelete="SET NULL"), index=True
    )
    report_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("reports.id", ondelete="SET NULL"), index=True
    )
    expedition_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("expeditions.id", ondelete="SET NULL"), index=True
    )

    publication: Mapped[Publication | None] = relationship(back_populates="documents")
    report: Mapped[Report | None] = relationship(back_populates="documents")
    expedition: Mapped[Expedition | None] = relationship(back_populates="documents")
    chunks: Mapped[list[DocumentChunk]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DocumentChunk.chunk_number",
    )


class DocumentChunk(UUIDMixin, Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "chunk_number",
            name="uq_document_chunks_document_number",
        ),
    )

    document_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_number: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer)
    section_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    document: Mapped[Document] = relationship(back_populates="chunks")
