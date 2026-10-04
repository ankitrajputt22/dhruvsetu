"""The real starter repository: what `python -m app.seed` puts in the database.

These tests run offline. They read the committed data files and the local
database, and never fetch anything from the source websites.
"""
import csv
import hashlib
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app import seed
from app.database import SessionLocal
from app.datasets.files import DATASET_STORE
from app.ingestion.service import BACKEND_ROOT, DOCUMENT_STORE
from app.main import app
from app.models import (
    Dataset,
    Document,
    Expedition,
    Publication,
    ResearchStation,
    ResearcherAccessRequest,
    User,
)
from conftest import create_test_user, delete_test_users

client = TestClient(app)

POLYNYA = seed.REAL_IDS["datasets"]["maud-rise-polynya"]
POLYNYA_FILE = DATASET_STORE / seed.DATASETS["maud-rise-polynya"]["file_name"]
DEY_2026 = seed.REAL_IDS["publications"]["dey-2026"]
SYNTHETIC_WORDS = ("demo", "prototype", "placeholder", "fictional")


@pytest.fixture(scope="module", autouse=True)
def real_data():
    with SessionLocal() as session:
        seed.seed_real_data(session)
        seed.seed_real_documents(session)


def _real_records(session, entity: str) -> list:
    model = seed.MODEL_BY_ENTITY[entity]
    return list(
        session.scalars(
            select(model).where(model.id.in_(seed.REAL_IDS[entity].values()))
        ).all()
    )


def _counts(session) -> dict[str, int]:
    counts = {
        entity: session.scalar(select(func.count()).select_from(model))
        for entity, model in seed.MODEL_BY_ENTITY.items()
    }
    for name, model in (("documents", Document), ("users", User)):
        counts[name] = session.scalar(select(func.count()).select_from(model))
    return counts


def test_seed_is_safe_to_run_again() -> None:
    with SessionLocal() as session:
        before = _counts(session)
        summary = seed.seed_real_data(session)
        created, _ = seed.seed_real_documents(session)
        after = _counts(session)

        assert summary == seed.REAL_COUNTS
        # Nothing is added twice: no record, no document and no account.
        assert created == 0
        assert after == before
        for entity in ("publications", "datasets", "expeditions", "reports", "scientists"):
            names = [
                getattr(record, "title", None) or record.name
                for record in _real_records(session, entity)
            ]
            assert len(names) == len(set(names)) == seed.REAL_COUNTS[entity]


def test_seeded_records_are_real_and_name_their_source() -> None:
    with SessionLocal() as session:
        for entity in ("expeditions", "publications", "reports", "datasets", "media_assets"):
            for record in _real_records(session, entity):
                label = getattr(record, "title", None) or record.name
                assert record.is_demo_data is False, label
                assert record.source_url.startswith(("https://", "http://")), label
                assert not any(word in label.lower() for word in SYNTHETIC_WORDS), label
        for publication in _real_records(session, "publications"):
            assert publication.doi.startswith("10.")
            assert publication.source_url == f"https://doi.org/{publication.doi}"
            assert publication.authors and publication.journal and publication.publication_year
        for scientist in _real_records(session, "scientists"):
            # A profile links to the official page its details come from.
            assert scientist.profile_url.startswith(
                ("https://ncpor.res.in/profiles/details/", "https://orcid.org/")
            )
            assert scientist.institution is not None
        for institution in _real_records(session, "institutions"):
            assert institution.website.startswith("http")
        stations = session.scalars(
            select(ResearchStation).where(
                ResearchStation.id.in_(seed.STATION_IDS["research_stations"].values())
            )
        ).all()
        assert len(stations) == 3
        for station in stations:
            assert station.source_url.startswith("https://ncpor.res.in/")
            assert not any(word in station.name.lower() for word in SYNTHETIC_WORDS)


def test_a_real_source_is_not_verified_by_itself() -> None:
    with SessionLocal() as session:
        # A new record starts as Uploaded: it has a real source, but nobody at
        # DhruvSetu has checked it yet.
        fresh = seed._upsert(session, Dataset, str(uuid4()), title="Test upsert dataset")
        assert fresh.verification_status == "uploaded"
        assert fresh.is_demo_data is False
        session.rollback()

        dataset = session.get(Dataset, POLYNYA)
        original = dataset.verification_status
        try:
            # What an admin decided is kept when the seed runs again.
            dataset.verification_status = "reviewed"
            session.commit()
            seed.seed_real_data(session)
            session.refresh(dataset)
            assert dataset.verification_status == "reviewed"
        finally:
            dataset.verification_status = original
            session.commit()

    for item in seed.DATASETS.values():
        assert "verification_status" not in item


def test_relationships_are_only_the_sourced_ones() -> None:
    with SessionLocal() as session:
        for key, item in seed.PUBLICATIONS.items():
            publication = session.get(Publication, seed.REAL_IDS["publications"][key])
            assert {person.id for person in publication.scientists} == {
                seed.REAL_IDS["scientists"][person] for person in item["scientists"]
            }
            # Every linked profile is one of the paper's authors.
            for person in item["scientists"]:
                assert person.capitalize() in item["authors"], (key, person)
            # No source says which expedition a paper belongs to.
            assert publication.expeditions == []

        arctic = session.get(Expedition, seed.REAL_IDS["expeditions"]["arctic-15"])
        assert {place.name for place in arctic.locations} == {
            "Himadri Station",
            "Kongsfjorden (IndARC mooring site)",
        }
        assert [report.title for report in arctic.reports] == [
            "15th Indian Arctic Expedition Report (2024-2025)"
        ]
        antarctic = session.get(Expedition, seed.REAL_IDS["expeditions"]["isea-41"])
        assert {place.name for place in antarctic.locations} == {
            "Maitri Station",
            "Bharati Station",
        }
        for expedition in _real_records(session, "expeditions"):
            assert expedition.datasets == []
            assert expedition.source_url.startswith("https://")


def test_removing_demo_records_leaves_real_and_user_data_alone(tmp_path_factory) -> None:
    from demo_data import load_demo_fixtures

    user = create_test_user("user")
    try:
        with SessionLocal() as session:
            session.add(
                ResearcherAccessRequest(
                    user_id=user.id,
                    institution="Test Polar Institute",
                    research_area="Glaciology",
                    reason="To submit field notes.",
                )
            )
            submitted = Dataset(
                title="Prototype dataset submitted by a researcher",
                verification_status="uploaded",
                is_demo_data=False,
                submitted_by_user_id=user.id,
            )
            session.add(submitted)
            session.commit()
            submitted_id = submitted.id
            real_before = {
                entity: len(_real_records(session, entity)) for entity in seed.REAL_IDS
            }
            real_documents = session.scalar(
                select(func.count()).select_from(Document).where(Document.is_demo_data.is_(False))
            )

            removed = seed.remove_demo_data(session)

            # The synthetic records are gone, all of them.
            assert removed["documents"] == len(seed.DEMO_DOCUMENT_TITLES)
            for entity, ids in seed.DEMO_IDS.items():
                assert removed[entity] == len(ids)
                model = seed.MODEL_BY_ENTITY[entity]
                assert session.scalars(
                    select(model.id).where(model.id.in_(ids.values()))
                ).all() == []
            assert session.scalar(
                select(func.count()).select_from(Document).where(Document.is_demo_data.is_(True))
            ) == 0
            # Real records, the account, its request and its submission stay.
            assert {
                entity: len(_real_records(session, entity)) for entity in seed.REAL_IDS
            } == real_before
            assert session.scalar(
                select(func.count()).select_from(Document).where(Document.is_demo_data.is_(False))
            ) == real_documents
            assert session.get(User, user.id) is not None
            assert session.get(Dataset, submitted_id).submitted_by_user_id == user.id
            assert session.scalar(
                select(func.count())
                .select_from(ResearcherAccessRequest)
                .where(ResearcherAccessRequest.user_id == user.id)
            ) == 1
            # A second run finds nothing left to remove.
            assert not any(seed.remove_demo_data(session).values())

            session.delete(session.get(Dataset, submitted_id))
            session.commit()
    finally:
        delete_test_users([user.id])
        # Other tests still use the temporary demo fixtures.
        load_demo_fixtures(tmp_path_factory.mktemp("demo-documents-reloaded"))


def test_real_dataset_file_keeps_every_row_of_the_source_table() -> None:
    with POLYNYA_FILE.open(encoding="utf-8", newline="") as file:
        rows = list(csv.reader(file))

    assert rows[0] == [
        "Year",
        "ssNa_flux ( μg m⁻² yr⁻¹)",
        "δ18O (‰)",
        "d-excess",
        "Snow Accumulation (m w.e. yr⁻¹)",
        "Polynya Index - with accumulation",
        "Polynya Index - without accumulation",
    ]
    # One row for each year of the source table, from 2016 back to 1774.
    assert [row[0] for row in rows[1:]] == [str(year) for year in range(2016, 1773, -1)]
    assert all(len(row) == 7 and all(row) for row in rows)
    # The first and last rows hold the values of the source file.
    assert rows[1][1:] == ["10.165", "-17.713", "4.1942", "0.14452", "0.039256", "0.047581"]
    assert rows[-1][1:] == ["80.127", "-18.569", "6.3136", "0.44059", "0.60237", "0.57055"]


def test_dataset_explorer_works_with_the_real_dataset() -> None:
    detail = client.get(f"/api/datasets/{POLYNYA}")
    preview = client.get(f"/api/datasets/{POLYNYA}/preview")
    download = client.get(f"/api/datasets/{POLYNYA}/download")

    assert detail.status_code == 200
    body = detail.json()
    assert body["title"] == "Maud Rise Polynya index and ice core proxy records, 1774-2016"
    assert body["is_demo_data"] is False
    assert body["file_type"] == "csv"
    assert body["source_url"].startswith("https://data.ncpor.res.in/")
    # The description says where the data come from and how the file was made.
    assert "https://doi.org/10.5194/tc-20-4117-2026" in body["description"]
    assert "no value was altered" in body["description"]
    assert body["file"]["available"] is True
    assert body["file"]["previewable"] is True
    assert {topic["name"] for topic in body["research_topics"]} == {
        "Paleoclimate and Ice Cores",
        "Sea Ice and Polynyas",
    }

    assert preview.status_code == 200
    table = preview.json()
    assert (table["row_count"], table["column_count"]) == (243, 7)
    assert table["statistics_row_count"] == 243
    assert all(column["type"] == "number" for column in table["columns"])
    year = table["columns"][0]
    assert year["name"] == "Year"
    assert (year["statistics"]["minimum"], year["statistics"]["maximum"]) == (1774, 2016)
    assert table["rows"][0] == [2016, 10.165, -17.713, 4.1942, 0.14452, 0.039256, 0.047581]

    # The download is the stored file, byte for byte.
    assert download.status_code == 200
    assert download.content == POLYNYA_FILE.read_bytes()


def test_datasets_without_a_local_copy_say_so() -> None:
    listed = {item["id"]: item for item in client.get("/api/datasets").json()}

    assert listed[POLYNYA]["has_file"] is True
    assert listed[seed.REAL_IDS["datasets"]["kongsfjorden-pom"]]["has_file"] is True
    for key in ("maitri-surface-data", "ice-rise-radar"):
        dataset = listed[seed.REAL_IDS["datasets"][key]]
        assert dataset["has_file"] is False
        assert dataset["source_url"].startswith("https://data.ncpor.res.in")
        assert "DhruvSetu holds no copy" in dataset["description"]
        assert client.get(f"/api/datasets/{dataset['id']}/preview").status_code == 404


def test_real_documents_are_ingested_with_their_provenance() -> None:
    documents = {item["title"]: item for item in client.get("/api/documents").json()}

    for item in seed.DOCUMENTS:
        listed = documents[item.title]
        assert (DOCUMENT_STORE / item.file_name).is_file()
        assert listed["is_demo_data"] is False
        assert listed["source_url"] == item.source_url
        assert listed["source_type"] == item.source_type
        assert listed["publication_date"] == item.publication_date.isoformat()
        assert listed["chunk_count"] >= 1
        expected = "publication" if item.publication else "expedition" if item.expedition else None
        assert [resource["type"] for resource in listed["related_resources"]] == (
            [expected] if expected else []
        )
        detail = client.get(f"/api/documents/{listed['id']}").json()
        assert detail["submitted_by"] is None
        if item.file_name.endswith(".pdf"):
            # Page numbers are kept for the papers, so an answer can cite a page.
            assert detail["first_page"] == 1
            assert detail["last_page"] > 1

    with SessionLocal() as session:
        stored = session.scalars(
            select(Document).where(Document.title.in_([item.title for item in seed.DOCUMENTS]))
        ).all()
        assert len(stored) == len(seed.DOCUMENTS)
        for document in stored:
            content = (BACKEND_ROOT / document.file_path).read_bytes()
            assert hashlib.sha256(content).hexdigest() == document.file_hash


def test_map_shows_the_real_stations_and_field_sites() -> None:
    locations = {item["id"]: item for item in client.get("/api/map").json()}

    expected = {
        seed.STATION_IDS["locations"]["maitri"]: (-70.764444, 11.734167, "antarctic", "station"),
        seed.STATION_IDS["locations"]["bharati"]: (-69.406833, 76.195333, "antarctic", "station"),
        seed.STATION_IDS["locations"]["himadri"]: (78.916667, 11.933333, "arctic", "station"),
        seed.REAL_IDS["locations"]["kongsfjorden"]: (
            78.933333, 12.0, "arctic", "expedition_location",
        ),
        seed.REAL_IDS["locations"]["djupranen"]: (-70.18, 9.18, "antarctic", "other"),
    }
    for location_id, (latitude, longitude, region, kind) in expected.items():
        place = locations[location_id]
        assert (place["latitude"], place["longitude"]) == (latitude, longitude)
        assert place["mappable"] is True
        assert place["polar_region"] == region
        assert place["location_type"] == kind
        assert place["is_demo_data"] is False

    himadri = locations[seed.STATION_IDS["locations"]["himadri"]]
    assert {item["name"] for item in himadri["expeditions"]} == {
        "14th Indian Arctic Expedition (2023-24)",
        "15th Indian Arctic Expedition (2024-25)",
    }
    assert himadri["stations"][0]["source_url"] == (
        "https://ncpor.res.in/app/webroot/pages/view/340-himadri-station"
    )


@pytest.mark.parametrize("draft_format", ["social_post", "news_brief"])
def test_outreach_draft_from_a_real_record_has_no_demo_warning(draft_format) -> None:
    options = client.get("/api/outreach/sources", params={"type": "publication"}).json()
    option = next(item for item in options if item["id"] == DEY_2026)
    assert option["is_demo_data"] is False

    response = client.post(
        "/api/outreach/generate",
        json={
            "resource_type": "publication",
            "resource_id": DEY_2026,
            "audience": "public",
            "format": draft_format,
        },
    )

    assert response.status_code == 200
    result = response.json()
    codes = {warning["code"] for warning in result["warnings"]}
    assert "demo_data" not in codes
    assert "Demo / Prototype Data" not in result["draft"]["text"]
    assert result["source"]["is_demo_data"] is False
    assert result["source"]["source_url"] == "https://doi.org/10.5194/tc-20-4117-2026"
    # A real source that DhruvSetu has not verified still carries that notice.
    assert ("not_verified" in codes) == (option["verification_status"] != "verified")
    facts = {fact["label"]: fact["value"] for fact in result["source"]["facts"]}
    assert facts["Journal"] == "The Cryosphere, 20, 4117-4131"
    assert facts["Authors"].startswith("Rahul Dey, Chavarukonam M. Laluraj")
    assert "Original source: https://doi.org/10.5194/tc-20-4117-2026" in result["draft"]["text"]


def test_outreach_draft_from_a_real_expedition_names_its_source() -> None:
    expedition = seed.EXPEDITIONS["isea-41"]

    result = client.post(
        "/api/outreach/generate",
        json={
            "resource_type": "expedition",
            "resource_id": seed.REAL_IDS["expeditions"]["isea-41"],
            "audience": "student",
            "format": "short_explanation",
        },
    ).json()

    assert result["source"]["source_url"] == expedition["source_url"]
    assert f"Original source: {expedition['source_url']}" in result["draft"]["text"]
    assert "demo_data" not in {warning["code"] for warning in result["warnings"]}


def test_public_lists_hold_the_real_records() -> None:
    expeditions = {item["name"]: item for item in client.get("/api/expeditions").json()}
    scientists = {item["name"]: item for item in client.get("/api/scientists").json()}
    publications = {item["title"]: item for item in client.get("/api/publications").json()}

    for item in seed.EXPEDITIONS.values():
        assert expeditions[item["name"]]["source_url"] == item["source_url"]
        assert expeditions[item["name"]]["is_demo_data"] is False
    thamban = scientists["Thamban Meloth"]
    assert thamban["designation"] == "Director"
    assert thamban["profile_url"] == "https://ncpor.res.in/profiles/details/21"
    assert thamban["institution"] == {
        "id": seed.REAL_IDS["institutions"]["ncpor"],
        "name": "National Centre for Polar and Ocean Research (NCPOR)",
        "website": "https://ncpor.res.in",
    }
    dey = publications[seed.PUBLICATIONS["dey-2026"]["title"]]
    assert dey["journal"] == "The Cryosphere, 20, 4117-4131"
    assert dey["authors"].startswith("Rahul Dey, Chavarukonam M. Laluraj")
    assert dey["doi"] == "10.5194/tc-20-4117-2026"


def test_search_finds_real_records() -> None:
    def titles(query: str) -> set[str]:
        response = client.get("/api/search", params={"q": query})
        assert response.status_code == 200
        return {item["title"] for item in response.json()}

    assert seed.PUBLICATIONS["goel-2026"]["title"] in titles("Dronning Maud Land")
    assert "15th Indian Arctic Expedition (2024-25)" in titles("Indian Arctic Expedition")
    assert seed.PUBLICATIONS["jena-2020"]["title"] in titles("Southern Ocean")
    assert seed.DATASETS["maud-rise-polynya"]["title"] in titles("ice core")

    # A scientist is found with the official page the profile comes from.
    found = client.get("/api/search", params={"q": "Thamban", "type": "scientist"}).json()
    assert [(item["title"], item["source_url"]) for item in found] == [
        ("Thamban Meloth", "https://ncpor.res.in/profiles/details/21")
    ]
    # No real record is found by these words. Only the test fixtures are.
    for query in ("demo", "prototype"):
        found = client.get("/api/search", params={"q": query}).json()
        assert all(item["is_demo_data"] for item in found)
