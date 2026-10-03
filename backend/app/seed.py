from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
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


DEMO_DATASET_FILE_NAME = "demo-prototype-preview-sample.csv"


def _demo_id(entity: str, key: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dhruvsetu-demo:{entity}:{key}"))


DEMO_IDS = {
    "institutions": {
        key: _demo_id("institution", key) for key in ("polar", "ocean")
    },
    "scientists": {
        key: _demo_id("scientist", key)
        for key in ("alpha", "beta", "gamma", "delta", "epsilon")
    },
    "expeditions": {
        key: _demo_id("expedition", key) for key in ("climate", "sea-ice", "biology")
    },
    "research_topics": {
        key: _demo_id("research-topic", key)
        for key in ("climate", "sea-ice", "atmosphere", "biodiversity")
    },
    "locations": {
        key: _demo_id("location", key)
        for key in ("coastal", "inland", "ocean", "field-area")
    },
    "research_stations": {
        key: _demo_id("research-station", key) for key in ("coastal", "inland")
    },
    "publications": {
        key: _demo_id("publication", key)
        for key in ("climate", "sea-ice", "atmosphere", "biodiversity", "overview")
    },
    "reports": {
        key: _demo_id("report", key) for key in ("climate", "sea-ice", "biology")
    },
    "datasets": {
        key: _demo_id("dataset", key)
        for key in ("temperature", "sea-ice", "atmosphere", "biodiversity", "preview")
    },
    "media_assets": {
        key: _demo_id("media-asset", key)
        for key in (
            "climate-photo",
            "climate-diagram",
            "sea-ice-photo",
            "sea-ice-map",
            "biology-photo",
            "biology-chart",
        )
    },
}

DEMO_COUNTS = {entity: len(ids) for entity, ids in DEMO_IDS.items()}


@dataclass(frozen=True)
class StationLocation:
    key: str
    station_name: str
    location_name: str
    region: str
    latitude: Decimal
    longitude: Decimal
    published_coordinates: str
    source: str


# Real Indian research stations. These are the only seeded records that are
# not demo data. Each coordinate is the value published by the National Centre
# for Polar and Ocean Research (NCPOR), converted to decimal degrees and
# rounded to six places. Nothing here is estimated.
#
# Maitri: some NCPOR data pages list slightly different coordinates. The
# values from the NCPOR Maitri station page are used, and only those.
STATION_LOCATIONS = (
    StationLocation(
        key="bharati",
        station_name="Bharati",
        location_name="Bharati Station",
        region="Antarctica",
        latitude=Decimal("-69.406833"),
        longitude=Decimal("76.195333"),
        published_coordinates="69°24.41′ S, 76°11.72′ E",
        source="NCPOR Bharati station page",
    ),
    StationLocation(
        key="maitri",
        station_name="Maitri",
        location_name="Maitri Station",
        region="Antarctica",
        latitude=Decimal("-70.764444"),
        longitude=Decimal("11.734167"),
        published_coordinates="70°45′52″ S, 11°44′03″ E",
        source="NCPOR Maitri station page",
    ),
    StationLocation(
        key="himadri",
        station_name="Himadri",
        location_name="Himadri Station",
        region="Arctic",
        latitude=Decimal("78.916667"),
        longitude=Decimal("11.933333"),
        published_coordinates="78°55′ N, 11°56′ E",
        source="NCPOR Arctic data portal (Himadri)",
    ),
)


def _station_id(entity: str, key: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dhruvsetu-station:{entity}:{key}"))


STATION_IDS = {
    "locations": {item.key: _station_id("location", item.key) for item in STATION_LOCATIONS},
    "research_stations": {
        item.key: _station_id("research-station", item.key) for item in STATION_LOCATIONS
    },
}

MODEL_BY_ENTITY = {
    "institutions": Institution,
    "scientists": Scientist,
    "expeditions": Expedition,
    "research_topics": ResearchTopic,
    "locations": Location,
    "research_stations": ResearchStation,
    "publications": Publication,
    "reports": Report,
    "datasets": Dataset,
    "media_assets": MediaAsset,
}


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


def seed_station_locations(session: Session) -> int:
    """Add the real station locations, or bring them back to the published values.

    No expeditions are linked here. The demo expeditions stay demo content and
    are not connected to real stations.
    """
    for item in STATION_LOCATIONS:
        location_id = STATION_IDS["locations"][item.key]
        location = session.get(Location, location_id)
        if location is None:
            location = Location(id=location_id)
            session.add(location)
        location.name = item.location_name
        location.region = item.region
        location.latitude = item.latitude
        location.longitude = item.longitude
        location.description = (
            f"Location of India's {item.station_name} research station. "
            f"Coordinates {item.published_coordinates}, from the {item.source}."
        )

        station_id = STATION_IDS["research_stations"][item.key]
        station = session.get(ResearchStation, station_id)
        if station is None:
            # A new station starts as "uploaded". A status set later is kept.
            station = ResearchStation(id=station_id, verification_status="uploaded")
            session.add(station)
        station.name = item.station_name
        station.location = location
        place = "the Arctic" if item.region == "Arctic" else item.region
        station.description = f"Indian research station in {place}."

    session.commit()
    return len(STATION_LOCATIONS)


def main() -> None:
    with SessionLocal() as session:
        summary = seed_demo_data(session)
        station_count = seed_station_locations(session)

    print("DhruvSetu demo data is ready:")
    for entity, expected in DEMO_COUNTS.items():
        print(f"- {entity.replace('_', ' ').title()}: {summary[entity]}/{expected}")
    print(f"Real station locations with published coordinates: {station_count}")


if __name__ == "__main__":
    main()
