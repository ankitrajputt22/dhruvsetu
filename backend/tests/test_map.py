from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import SessionLocal
from app.geo import fits_web_map, polar_region, valid_coordinates
from app.ingestion.seed_demo import seed_demo_documents
from app.main import app
from app.models import Expedition, Location, ResearchStation
from app.seed import DEMO_IDS, STATION_IDS, STATION_LOCATIONS, seed_station_locations

client = TestClient(app)

TEST_PREFIX = "Test map location"


def _map() -> dict[str, dict]:
    response = client.get("/api/map")
    assert response.status_code == 200
    return {item["id"]: item for item in response.json()}


@pytest.fixture
def make_location():
    """Create temporary locations and remove them after the test."""
    seed_demo_documents()
    created: list[str] = []

    def create(
        name: str,
        latitude=None,
        longitude=None,
        *,
        station_status: str | None = None,
        expedition_key: str | None = None,
    ) -> str:
        with SessionLocal() as session:
            location = Location(
                name=f"{TEST_PREFIX} {name}",
                region="Test region",
                latitude=latitude,
                longitude=longitude,
                description="Temporary test record.",
            )
            if station_status is not None:
                location.research_stations.append(
                    ResearchStation(
                        name=f"{TEST_PREFIX} station {name}",
                        verification_status=station_status,
                    )
                )
            if expedition_key is not None:
                location.expeditions.append(
                    session.get(Expedition, DEMO_IDS["expeditions"][expedition_key])
                )
            session.add(location)
            session.commit()
            created.append(location.id)
            return location.id

    try:
        yield create
    finally:
        with SessionLocal() as session:
            for location in session.scalars(
                select(Location).where(Location.id.in_(created))
            ).all():
                for station in list(location.research_stations):
                    session.delete(station)
                location.expeditions.clear()
                session.delete(location)
            session.commit()


def test_coordinate_rules() -> None:
    assert valid_coordinates(Decimal("-70.5"), Decimal("11.5")) == (-70.5, 11.5)
    assert valid_coordinates(None, Decimal("11.5")) is None
    assert valid_coordinates(Decimal("-70.5"), None) is None
    assert valid_coordinates(Decimal("120"), Decimal("11.5")) is None
    assert valid_coordinates(Decimal("10"), Decimal("200")) is None

    assert polar_region(-60.0) == "antarctic"
    assert polar_region(-59.9) is None
    assert polar_region(66.5) == "arctic"
    assert polar_region(66.4) is None
    assert polar_region(None) is None

    assert fits_web_map(-85.0) is True
    assert fits_web_map(-89.9) is False
    assert fits_web_map(None) is False


def test_demo_locations_are_listed_without_coordinates() -> None:
    seed_demo_documents()
    locations = _map()

    for location_id in DEMO_IDS["locations"].values():
        location = locations[location_id]
        assert location["latitude"] is None
        assert location["longitude"] is None
        assert location["mappable"] is False
        assert location["polar_region"] is None
        assert location["is_demo_data"] is True
        assert location["description"] == "Demo location without real coordinates."


def test_station_and_expedition_location_types() -> None:
    seed_demo_documents()
    locations = _map()
    coastal = locations[DEMO_IDS["locations"]["coastal"]]
    ocean = locations[DEMO_IDS["locations"]["ocean"]]

    assert coastal["location_type"] == "station"
    assert coastal["stations"] == [
        {
            "id": DEMO_IDS["research_stations"]["coastal"],
            "name": "Demo Coastal Research Station",
            "description": "Prototype station record for platform testing.",
            "verification_status": "uploaded",
            "is_demo_data": True,
        }
    ]
    assert ocean["location_type"] == "expedition_location"
    assert ocean["stations"] == []


def test_related_expeditions_come_from_explicit_links() -> None:
    seed_demo_documents()
    locations = _map()
    coastal = locations[DEMO_IDS["locations"]["coastal"]]
    inland = locations[DEMO_IDS["locations"]["inland"]]

    assert coastal["expedition_count"] == 3
    assert {item["id"] for item in coastal["expeditions"]} == set(
        DEMO_IDS["expeditions"].values()
    )
    assert inland["expedition_count"] == 1
    assert inland["expeditions"] == [
        {
            "id": DEMO_IDS["expeditions"]["climate"],
            "name": "Demo Antarctic Climate Expedition",
            "expedition_number": "DEMO-EXP-001",
            "verification_status": "uploaded",
            "is_demo_data": True,
        }
    ]


def test_related_research_is_reached_through_expeditions() -> None:
    seed_demo_documents()
    inland = _map()[DEMO_IDS["locations"]["inland"]]

    # The inland area is linked only to the climate expedition.
    assert {item["name"] for item in inland["research_topics"]} == {
        "Demo Antarctic Climate",
        "Demo Polar Atmosphere",
    }
    assert DEMO_IDS["datasets"]["temperature"] in {
        item["id"] for item in inland["datasets"]
    }
    assert DEMO_IDS["datasets"]["sea-ice"] not in {
        item["id"] for item in inland["datasets"]
    }
    assert [item["title"] for item in inland["documents"]] == [
        "Demo Antarctic Climate Field Notes"
    ]


def test_valid_coordinates_are_returned_with_a_polar_region(make_location) -> None:
    antarctic = make_location("antarctic", Decimal("-70.5"), Decimal("11.5"))
    arctic = make_location("arctic", Decimal("79.0"), Decimal("12.0"))
    elsewhere = make_location("elsewhere", Decimal("15.0"), Decimal("74.0"))
    locations = _map()

    assert locations[antarctic]["latitude"] == -70.5
    assert locations[antarctic]["longitude"] == 11.5
    assert locations[antarctic]["mappable"] is True
    assert locations[antarctic]["polar_region"] == "antarctic"
    assert locations[arctic]["polar_region"] == "arctic"
    assert locations[elsewhere]["mappable"] is True
    assert locations[elsewhere]["polar_region"] is None


def test_unusable_coordinates_are_not_mapped(make_location) -> None:
    only_latitude = make_location("only latitude", Decimal("-70.5"), None)
    impossible = make_location("impossible", Decimal("120"), Decimal("11.5"))
    near_pole = make_location("near pole", Decimal("-89.9"), Decimal("0"))
    locations = _map()

    for location_id in (only_latitude, impossible):
        assert locations[location_id]["latitude"] is None
        assert locations[location_id]["longitude"] is None
        assert locations[location_id]["mappable"] is False
        assert locations[location_id]["polar_region"] is None

    # Real coordinates that a standard web map cannot draw stay as text.
    assert locations[near_pole]["latitude"] == -89.9
    assert locations[near_pole]["mappable"] is False
    assert locations[near_pole]["polar_region"] == "antarctic"


def test_location_types_and_station_verification(make_location) -> None:
    station = make_location(
        "with station", Decimal("-70.5"), Decimal("11.5"), station_status="reviewed"
    )
    expedition = make_location("with expedition", expedition_key="sea-ice")
    other = make_location("unlinked")
    locations = _map()

    assert locations[station]["location_type"] == "station"
    assert locations[station]["stations"][0]["verification_status"] == "reviewed"
    # Coordinates do not change the verification status or the demo flag.
    assert locations[station]["stations"][0]["is_demo_data"] is False
    assert locations[station]["is_demo_data"] is False

    assert locations[expedition]["location_type"] == "expedition_location"
    assert locations[expedition]["expedition_count"] == 1
    assert locations[expedition]["expeditions"][0]["id"] == (
        DEMO_IDS["expeditions"]["sea-ice"]
    )

    assert locations[other]["location_type"] == "other"
    assert locations[other]["expedition_count"] == 0
    assert locations[other]["expeditions"] == []
    assert locations[other]["research_topics"] == []
    assert locations[other]["datasets"] == []
    assert locations[other]["documents"] == []


def test_map_response_has_only_map_fields() -> None:
    seed_demo_documents()
    location = _map()[DEMO_IDS["locations"]["coastal"]]

    assert set(location) == {
        "id",
        "name",
        "region",
        "description",
        "latitude",
        "longitude",
        "mappable",
        "location_type",
        "polar_region",
        "is_demo_data",
        "stations",
        "expeditions",
        "expedition_count",
        "research_topics",
        "datasets",
        "documents",
    }


def test_expedition_detail_includes_location_coordinates(make_location) -> None:
    with_coordinates = make_location(
        "expedition site", Decimal("-70.5"), Decimal("11.5"), expedition_key="sea-ice"
    )
    impossible = make_location(
        "bad site", Decimal("120"), Decimal("11.5"), expedition_key="sea-ice"
    )

    response = client.get(f"/api/expeditions/{DEMO_IDS['expeditions']['sea-ice']}")

    assert response.status_code == 200
    locations = {item["id"]: item for item in response.json()["locations"]}
    assert locations[with_coordinates]["latitude"] == -70.5
    assert locations[with_coordinates]["longitude"] == 11.5
    assert locations[impossible]["latitude"] is None
    assert locations[impossible]["longitude"] is None
    assert locations[DEMO_IDS["locations"]["ocean"]]["latitude"] is None


# Published NCPOR coordinates, as decimal degrees.
OFFICIAL_COORDINATES = {
    "bharati": (-69.406833, 76.195333, "antarctic"),
    "maitri": (-70.764444, 11.734167, "antarctic"),
    "himadri": (78.916667, 11.933333, "arctic"),
}


def _seed_stations() -> None:
    with SessionLocal() as session:
        seed_station_locations(session)


def test_station_locations_are_seeded_with_published_coordinates() -> None:
    _seed_stations()

    assert {item.key for item in STATION_LOCATIONS} == set(OFFICIAL_COORDINATES)
    with SessionLocal() as session:
        for key, (latitude, longitude, _) in OFFICIAL_COORDINATES.items():
            location = session.get(Location, STATION_IDS["locations"][key])
            station = session.get(ResearchStation, STATION_IDS["research_stations"][key])
            assert location is not None and station is not None
            assert location.latitude == Decimal(str(latitude))
            assert location.longitude == Decimal(str(longitude))
            assert -90 <= location.latitude <= 90
            assert -180 <= location.longitude <= 180
            assert station.location_id == location.id
            # The source of the coordinates is kept with the record.
            assert "NCPOR" in location.description


def test_map_returns_station_coordinates_and_polar_regions() -> None:
    _seed_stations()
    locations = _map()

    for key, (latitude, longitude, region) in OFFICIAL_COORDINATES.items():
        location = locations[STATION_IDS["locations"][key]]
        assert location["latitude"] == latitude
        assert location["longitude"] == longitude
        assert location["mappable"] is True
        assert location["polar_region"] == region
        assert location["location_type"] == "station"
        assert [item["id"] for item in location["stations"]] == [
            STATION_IDS["research_stations"][key]
        ]
        # Real station metadata is not demo data and is not linked to the
        # demo expeditions.
        assert location["is_demo_data"] is False
        assert location["stations"][0]["is_demo_data"] is False
        assert location["expedition_count"] == 0
        assert location["expeditions"] == []

    assert locations[STATION_IDS["locations"]["bharati"]]["name"] == "Bharati Station"
    assert locations[STATION_IDS["locations"]["himadri"]]["region"] == "Arctic"


def test_station_seed_does_not_touch_demo_locations() -> None:
    seed_demo_documents()
    _seed_stations()
    locations = _map()

    for location_id in DEMO_IDS["locations"].values():
        assert locations[location_id]["latitude"] is None
        assert locations[location_id]["mappable"] is False
        assert locations[location_id]["is_demo_data"] is True


def test_station_seed_is_idempotent() -> None:
    _seed_stations()
    with SessionLocal() as session:
        locations_before = session.scalar(select(func.count()).select_from(Location))
        stations_before = session.scalar(select(func.count()).select_from(ResearchStation))

    _seed_stations()
    _seed_stations()

    with SessionLocal() as session:
        assert session.scalar(select(func.count()).select_from(Location)) == locations_before
        assert (
            session.scalar(select(func.count()).select_from(ResearchStation))
            == stations_before
        )
        for item in STATION_LOCATIONS:
            assert (
                session.scalar(
                    select(func.count())
                    .select_from(Location)
                    .where(Location.name == item.location_name)
                )
                == 1
            )
            assert (
                session.scalar(
                    select(func.count())
                    .select_from(ResearchStation)
                    .where(ResearchStation.name == item.station_name)
                )
                == 1
            )


def test_station_seed_restores_coordinates_and_keeps_verification_status() -> None:
    _seed_stations()
    location_id = STATION_IDS["locations"]["maitri"]
    station_id = STATION_IDS["research_stations"]["maitri"]
    try:
        with SessionLocal() as session:
            session.get(Location, location_id).latitude = Decimal("-10")
            session.get(ResearchStation, station_id).verification_status = "reviewed"
            session.commit()

        _seed_stations()

        with SessionLocal() as session:
            assert session.get(Location, location_id).latitude == Decimal("-70.764444")
            # Seeding never changes a status a person has set.
            assert session.get(ResearchStation, station_id).verification_status == "reviewed"
    finally:
        with SessionLocal() as session:
            session.get(ResearchStation, station_id).verification_status = "uploaded"
            session.commit()
