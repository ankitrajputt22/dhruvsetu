"""Synthetic demo records, used only as test fixtures.

These are the records older versions of DhruvSetu seeded. The real starter
repository no longer contains them. Tests load them for the length of a test
run to cover the Demo Data label and every feature that reads connected
records, and remove them again afterwards.
"""
from __future__ import annotations

import shutil
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.datasets import files as dataset_files
from app.ingestion.service import ingest_document
from app.models import (
    Dataset,
    Expedition,
    Institution,
    Location,
    MediaAsset,
    Publication,
    Report,
    ResearchStation,
    ResearchTopic,
    Scientist,
)
from app.seed import DEMO_DATASET_FILE_NAME, DEMO_IDS, MODEL_BY_ENTITY, remove_demo_data

FIXTURES = Path(__file__).resolve().parent / "fixtures"
DEMO_DOCUMENT_FOLDER = FIXTURES / "documents"
DEMO_DATASET_FILE = FIXTURES / "datasets" / DEMO_DATASET_FILE_NAME


def _get_or_create(
    session: Session,
    model: type,
    record_id: str,
    **values: object,
):
    record = session.get(model, record_id)
    if record is None:
        record = model(id=record_id, **values)
        session.add(record)
    return record


def _connect(collection: list, records: Iterable) -> None:
    existing_ids = {record.id for record in collection}
    for record in records:
        if record.id not in existing_ids:
            collection.append(record)
            existing_ids.add(record.id)


def _count_demo_records(session: Session) -> dict[str, int]:
    return {
        entity: session.scalar(
            select(func.count())
            .select_from(MODEL_BY_ENTITY[entity])
            .where(MODEL_BY_ENTITY[entity].id.in_(ids.values()))
        )
        or 0
        for entity, ids in DEMO_IDS.items()
    }


def seed_demo_data(session: Session) -> dict[str, int]:
    institutions = {
        "polar": _get_or_create(
            session,
            Institution,
            DEMO_IDS["institutions"]["polar"],
            name="Demo Polar Research Institute",
            description="Prototype institution record for platform testing.",
            website=None,
        ),
        "ocean": _get_or_create(
            session,
            Institution,
            DEMO_IDS["institutions"]["ocean"],
            name="Prototype Ocean and Atmosphere Centre",
            description="Demo institution record for platform testing.",
            website=None,
        ),
    }

    scientist_details = {
        "alpha": ("Demo Scientist Alpha", "polar", "Antarctic climate"),
        "beta": ("Demo Scientist Beta", "polar", "Sea ice"),
        "gamma": ("Demo Scientist Gamma", "ocean", "Polar biodiversity"),
        "delta": ("Prototype Researcher Delta", "ocean", "Polar atmosphere"),
        "epsilon": ("Prototype Researcher Epsilon", "polar", "Field observations"),
    }
    scientists = {
        key: _get_or_create(
            session,
            Scientist,
            DEMO_IDS["scientists"][key],
            name=name,
            institution=institutions[institution_key],
            research_area=research_area,
            short_bio="Prototype profile for platform testing. It describes no real person.",
        )
        for key, (name, institution_key, research_area) in scientist_details.items()
    }

    topic_details = {
        "climate": "Demo Antarctic Climate",
        "sea-ice": "Demo Sea Ice",
        "atmosphere": "Demo Polar Atmosphere",
        "biodiversity": "Demo Polar Biodiversity",
    }
    topics = {
        key: _get_or_create(
            session,
            ResearchTopic,
            DEMO_IDS["research_topics"][key],
            name=name,
            description="Prototype research topic for testing connected records.",
        )
        for key, name in topic_details.items()
    }

    location_details = {
        "coastal": ("Demo Antarctic Coastal Area", "Prototype Antarctic region"),
        "inland": ("Demo Inland Ice Area", "Prototype Antarctic region"),
        "ocean": ("Demo Southern Ocean Area", "Prototype ocean region"),
        "field-area": ("Prototype Polar Field Area", "Prototype polar region"),
    }
    locations = {
        key: _get_or_create(
            session,
            Location,
            DEMO_IDS["locations"][key],
            name=name,
            region=region,
            latitude=None,
            longitude=None,
            description="Demo location without real coordinates.",
        )
        for key, (name, region) in location_details.items()
    }

    _get_or_create(
        session,
        ResearchStation,
        DEMO_IDS["research_stations"]["coastal"],
        name="Demo Coastal Research Station",
        location=locations["coastal"],
        description="Prototype station record for platform testing.",
        verification_status="uploaded",
    )
    _get_or_create(
        session,
        ResearchStation,
        DEMO_IDS["research_stations"]["inland"],
        name="Prototype Inland Research Station",
        location=locations["inland"],
        description="Demo station record for platform testing.",
        verification_status="uploaded",
    )

    expedition_details = {
        "climate": (
            "Demo Antarctic Climate Expedition",
            "DEMO-EXP-001",
            "Prototype expedition record for testing connected climate information.",
        ),
        "sea-ice": (
            "Demo Sea Ice Observation Expedition",
            "DEMO-EXP-002",
            "Prototype expedition record for testing connected sea ice information.",
        ),
        "biology": (
            "Prototype Polar Biodiversity Expedition",
            "DEMO-EXP-003",
            "Demo expedition record for testing connected biodiversity information.",
        ),
    }
    expeditions = {
        key: _get_or_create(
            session,
            Expedition,
            DEMO_IDS["expeditions"][key],
            name=name,
            expedition_number=number,
            summary=summary,
            start_date=None,
            end_date=None,
            verification_status="uploaded",
            is_demo_data=True,
        )
        for key, (name, number, summary) in expedition_details.items()
    }

    publication_details = {
        "climate": "Demo Overview of Antarctic Climate Records",
        "sea-ice": "Demo Sea Ice Observation Methods",
        "atmosphere": "Prototype Notes on Polar Atmosphere",
        "biodiversity": "Demo Polar Biodiversity Field Guide",
        "overview": "Prototype Connected Polar Research Summary",
    }
    publications = {
        key: _get_or_create(
            session,
            Publication,
            DEMO_IDS["publications"][key],
            title=title,
            publication_year=None,
            doi=None,
            source_url=None,
            summary="Prototype publication metadata for interface testing; not a citation.",
            verification_status="uploaded",
            is_demo_data=True,
        )
        for key, title in publication_details.items()
    }

    report_details = {
        "climate": "Demo Antarctic Climate Expedition Report",
        "sea-ice": "Demo Sea Ice Expedition Report",
        "biology": "Prototype Biodiversity Expedition Report",
    }
    reports = {
        key: _get_or_create(
            session,
            Report,
            DEMO_IDS["reports"][key],
            title=title,
            publication_date=None,
            source_url=None,
            summary="Prototype report metadata for platform testing; not a real report.",
            verification_status="uploaded",
            is_demo_data=True,
        )
        for key, title in report_details.items()
    }

    dataset_details = {
        "temperature": "Demo Antarctic Temperature Dataset",
        "sea-ice": "Demo Sea Ice Observation Dataset",
        "atmosphere": "Prototype Polar Atmosphere Dataset",
        "biodiversity": "Demo Biodiversity Observation Dataset",
    }
    datasets = {
        key: _get_or_create(
            session,
            Dataset,
            DEMO_IDS["datasets"][key],
            title=title,
            description="Metadata-only prototype dataset with no measurements or files.",
            file_type=None,
            source_url=None,
            verification_status="uploaded",
            is_demo_data=True,
        )
        for key, title in dataset_details.items()
    }

    # The only demo dataset with a file. The file holds placeholder values
    # for testing the dataset preview, not measurements.
    datasets["preview"] = _get_or_create(
        session,
        Dataset,
        DEMO_IDS["datasets"]["preview"],
        title="Demo Prototype Preview Dataset",
        description=(
            "Demo / Prototype Data. A small placeholder file for testing the "
            "dataset preview. The values are not measurements."
        ),
        file_type="csv",
        file_name=DEMO_DATASET_FILE_NAME,
        source_url=None,
        verification_status="uploaded",
        is_demo_data=True,
    )

    media_details = {
        "climate-photo": ("Demo Climate Field Photo", "image"),
        "climate-diagram": ("Demo Climate Overview Diagram", "diagram"),
        "sea-ice-photo": ("Demo Sea Ice Field Photo", "image"),
        "sea-ice-map": ("Prototype Sea Ice Map", "map"),
        "biology-photo": ("Demo Biodiversity Field Photo", "image"),
        "biology-chart": ("Prototype Biodiversity Chart", "chart"),
    }
    media_assets = {
        key: _get_or_create(
            session,
            MediaAsset,
            DEMO_IDS["media_assets"][key],
            title=title,
            media_type=media_type,
            description="Metadata-only demo media record with no attached file.",
            source_url=None,
            verification_status="uploaded",
            is_demo_data=True,
        )
        for key, (title, media_type) in media_details.items()
    }

    session.flush()

    expedition_links = {
        "climate": {
            "scientists": ("alpha", "beta"),
            "topics": ("climate", "atmosphere"),
            "locations": ("coastal", "inland"),
            "publications": ("climate", "overview"),
            "datasets": ("temperature", "atmosphere", "preview"),
            "reports": ("climate",),
            "media": ("climate-photo", "climate-diagram"),
        },
        "sea-ice": {
            "scientists": ("beta", "gamma", "delta"),
            "topics": ("sea-ice", "atmosphere"),
            "locations": ("ocean", "coastal"),
            "publications": ("sea-ice", "atmosphere"),
            "datasets": ("sea-ice", "atmosphere"),
            "reports": ("sea-ice",),
            "media": ("sea-ice-photo", "sea-ice-map"),
        },
        "biology": {
            "scientists": ("gamma", "delta", "epsilon"),
            "topics": ("biodiversity", "climate"),
            "locations": ("coastal", "field-area"),
            "publications": ("biodiversity", "overview"),
            "datasets": ("biodiversity",),
            "reports": ("biology",),
            "media": ("biology-photo", "biology-chart"),
        },
    }
    for key, links in expedition_links.items():
        expedition = expeditions[key]
        _connect(expedition.scientists, (scientists[item] for item in links["scientists"]))
        _connect(expedition.research_topics, (topics[item] for item in links["topics"]))
        _connect(expedition.locations, (locations[item] for item in links["locations"]))
        _connect(expedition.publications, (publications[item] for item in links["publications"]))
        _connect(expedition.datasets, (datasets[item] for item in links["datasets"]))
        _connect(expedition.reports, (reports[item] for item in links["reports"]))
        _connect(expedition.media_assets, (media_assets[item] for item in links["media"]))

    publication_links = {
        "climate": (("alpha", "beta"), ("climate",)),
        "sea-ice": (("beta", "gamma"), ("sea-ice",)),
        "atmosphere": (("delta",), ("atmosphere",)),
        "biodiversity": (("gamma", "epsilon"), ("biodiversity",)),
        "overview": (("alpha", "delta", "epsilon"), ("climate", "biodiversity")),
    }
    for key, (scientist_keys, topic_keys) in publication_links.items():
        _connect(publications[key].scientists, (scientists[item] for item in scientist_keys))
        _connect(publications[key].research_topics, (topics[item] for item in topic_keys))

    dataset_links = {
        "temperature": ("climate",),
        "sea-ice": ("sea-ice",),
        "atmosphere": ("atmosphere",),
        "biodiversity": ("biodiversity",),
        "preview": ("climate",),
    }
    for key, topic_keys in dataset_links.items():
        _connect(datasets[key].research_topics, (topics[item] for item in topic_keys))

    session.commit()
    return _count_demo_records(session)


@dataclass(frozen=True)
class DemoDocument:
    file_name: str
    title: str
    relationship: str
    related_id: str


DEMO_DOCUMENTS = (
    DemoDocument(
        file_name="demo-antarctic-climate.txt",
        title="Demo Antarctic Climate Field Notes",
        relationship="report_id",
        related_id=DEMO_IDS["reports"]["climate"],
    ),
    DemoDocument(
        file_name="demo-sea-ice-observations.txt",
        title="Demo Sea Ice Observation Notes",
        relationship="expedition_id",
        related_id=DEMO_IDS["expeditions"]["sea-ice"],
    ),
    DemoDocument(
        file_name="demo-polar-biodiversity.txt",
        title="Prototype Polar Biodiversity Field Guide Notes",
        relationship="publication_id",
        related_id=DEMO_IDS["publications"]["biodiversity"],
    ),
)

# Where the demo documents are stored during a test run.
_document_store: Path | None = None


def use_document_store(folder: Path) -> None:
    global _document_store
    _document_store = folder


def seed_demo_documents() -> tuple[int, int]:
    assert _document_store is not None, "Call use_document_store() first"
    created = 0
    chunk_count = 0
    with SessionLocal() as session:
        seed_demo_data(session)
        for item in DEMO_DOCUMENTS:
            result = ingest_document(
                session,
                DEMO_DOCUMENT_FOLDER / item.file_name,
                title=item.title,
                source_type="prototype",
                verification_status="uploaded",
                is_demo_data=True,
                document_store=_document_store,
                **{item.relationship: item.related_id},
            )
            created += int(not result.duplicate)
            chunk_count += result.chunk_count
    return created, chunk_count


def load_demo_fixtures(document_store: Path) -> None:
    """Put the demo records, documents and data file in place for the tests."""
    use_document_store(document_store)
    store = dataset_files.DATASET_STORE
    store.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(DEMO_DATASET_FILE, store / DEMO_DATASET_FILE_NAME)
    seed_demo_documents()


def unload_demo_fixtures() -> None:
    with SessionLocal() as session:
        remove_demo_data(session)
    (dataset_files.DATASET_STORE / DEMO_DATASET_FILE_NAME).unlink(missing_ok=True)
