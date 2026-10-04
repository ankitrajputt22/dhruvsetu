import re

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from demo_data import seed_demo_documents
from app.main import app
from app.models import Dataset, Expedition, ResearchTopic
from app.outreach.templates import SOCIAL_POST_LIMIT
from app.seed import DEMO_IDS

client = TestClient(app)

GENERATE_URL = "/api/outreach/generate"
SEA_ICE_EXPEDITION = DEMO_IDS["expeditions"]["sea-ice"]
AUDIENCES = ("student", "teacher", "journalist", "public")
FORMATS = ("short_explanation", "social_post", "classroom_note", "news_brief")


def _generate(resource_type: str, resource_id: str, audience: str, format: str):
    return client.post(
        GENERATE_URL,
        json={
            "resource_type": resource_type,
            "resource_id": resource_id,
            "audience": audience,
            "format": format,
        },
    )


def _draft(resource_type: str, resource_id: str, audience: str, format: str) -> dict:
    response = _generate(resource_type, resource_id, audience, format)
    assert response.status_code == 200, response.text
    return response.json()


def _headings(result: dict) -> list[str]:
    return [section["heading"] for section in result["draft"]["sections"]]


def _section(result: dict, heading: str) -> str:
    return next(
        section["body"]
        for section in result["draft"]["sections"]
        if section["heading"] == heading
    )


def _document_id(title: str) -> str:
    return next(
        item["id"] for item in client.get("/api/documents").json() if item["title"] == title
    )


@pytest.fixture(scope="module", autouse=True)
def demo_data():
    seed_demo_documents()


@pytest.fixture
def make_dataset():
    """Create temporary dataset records and remove them after the test."""
    created: list[str] = []

    def create(**values) -> str:
        with SessionLocal() as session:
            topic_names = values.pop("topics", ())
            expedition_keys = values.pop("expeditions", ())
            dataset = Dataset(**values)
            for name in topic_names:
                dataset.research_topics.append(
                    ResearchTopic(name=name, description=f"Stored description of {name}.")
                )
            for key in expedition_keys:
                dataset.expeditions.append(
                    session.get(Expedition, DEMO_IDS["expeditions"][key])
                )
            session.add(dataset)
            session.commit()
            created.append(dataset.id)
            return dataset.id

    try:
        yield create
    finally:
        with SessionLocal() as session:
            for dataset_id in created:
                dataset = session.get(Dataset, dataset_id)
                if dataset is None:
                    continue
                topics = list(dataset.research_topics)
                dataset.research_topics.clear()
                dataset.expeditions.clear()
                session.delete(dataset)
                for topic in topics:
                    session.delete(topic)
            session.commit()


def test_expedition_draft_uses_repository_information() -> None:
    result = _draft("expedition", SEA_ICE_EXPEDITION, "student", "short_explanation")

    assert result["generator"] == "template"
    assert result["draft"]["audience"] == "student"
    assert result["draft"]["format"] == "short_explanation"
    assert result["draft"]["title"] == "Demo Sea Ice Observation Expedition: a simple explanation"
    text = result["draft"]["text"]
    assert "Prototype expedition record for testing connected sea ice information." in text
    assert "- Expedition number: DEMO-EXP-002" in text
    assert "- Research topics: Demo Polar Atmosphere, Demo Sea Ice" in text
    assert "- Scientists: Demo Scientist Beta, Demo Scientist Gamma, Prototype Researcher Delta" in text
    assert "- Locations: Demo Antarctic Coastal Area, Demo Southern Ocean Area" in text
    # The assembled text is exactly the title plus the sections.
    assert text.startswith(result["draft"]["title"])
    for section in result["draft"]["sections"]:
        assert f"{section['heading']}\n{section['body']}" in text


@pytest.mark.parametrize(
    ("resource_type", "key_or_title"),
    [
        ("expedition", "expeditions:climate"),
        ("publication", "publications:sea-ice"),
        ("dataset", "datasets:preview"),
        ("report", "reports:climate"),
        ("document", "Demo Sea Ice Observation Notes"),
    ],
)
def test_every_supported_resource_type_can_be_drafted(resource_type, key_or_title) -> None:
    if ":" in key_or_title:
        group, key = key_or_title.split(":")
        resource_id = DEMO_IDS[group][key]
    else:
        resource_id = _document_id(key_or_title)

    for audience in AUDIENCES:
        for format in FORMATS:
            result = _draft(resource_type, resource_id, audience, format)
            assert result["source"]["id"] == resource_id
            assert result["source"]["resource_type"] == resource_type
            assert result["draft"]["text"].strip()
            assert "Sources" in _headings(result)
            assert "None" not in result["draft"]["text"]


def test_unknown_resource_id_is_not_found() -> None:
    for resource_type in ("expedition", "publication", "dataset", "document", "report"):
        response = _generate(
            resource_type, "00000000-0000-0000-0000-000000000000", "student", "short_explanation"
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "This repository item was not found."}

    # An id of one type is not accepted for another type.
    assert _generate("dataset", SEA_ICE_EXPEDITION, "public", "social_post").status_code == 404


@pytest.mark.parametrize(
    "change",
    [
        {"resource_type": "scientist"},
        {"resource_type": "../../etc/passwd"},
        {"audience": "investor"},
        {"audience": ""},
        {"format": "press_release"},
        {"format": "templates/secret"},
    ],
)
def test_unsupported_type_audience_or_format_is_rejected(change) -> None:
    payload = {
        "resource_type": "expedition",
        "resource_id": SEA_ICE_EXPEDITION,
        "audience": "student",
        "format": "short_explanation",
        **change,
    }

    response = client.post(GENERATE_URL, json=payload)

    assert response.status_code == 422


def test_demo_data_is_marked_in_warnings_and_in_the_draft() -> None:
    for format in FORMATS:
        result = _draft("expedition", SEA_ICE_EXPEDITION, "public", format)

        assert {"code": "demo_data", "message": "Based on Demo / Prototype Data"} in (
            result["warnings"]
        )
        assert result["source"]["is_demo_data"] is True
        assert "Demo / Prototype Data" in result["draft"]["text"]
        assert "Demo / Prototype Data" in _section(result, "Sources")
    post = _section(_draft("expedition", SEA_ICE_EXPEDITION, "public", "social_post"), "Post")
    assert post.startswith("[Demo / Prototype Data]")


@pytest.mark.parametrize(
    ("status", "label"),
    [("uploaded", "Uploaded"), ("reviewed", "Reviewed")],
)
def test_sources_that_are_not_verified_carry_a_notice(make_dataset, status, label) -> None:
    dataset_id = make_dataset(
        title="Outreach test dataset",
        description="Stored description for the outreach test.",
        verification_status=status,
    )

    result = _draft("dataset", dataset_id, "journalist", "news_brief")

    message = f"This source has not yet been marked Verified. Its status is {label}."
    assert {"code": "not_verified", "message": message} in result["warnings"]
    assert message in _section(result, "Note")
    assert f"Verification status: {label}" in _section(result, "Sources")
    assert result["source"]["verification_status"] == status
    # Generation is not blocked.
    assert result["draft"]["text"].strip()


def test_verified_source_that_is_not_demo_data_has_no_warnings(make_dataset) -> None:
    dataset_id = make_dataset(
        title="Outreach verified dataset",
        description="Stored description for the outreach test.",
        verification_status="verified",
        is_demo_data=False,
        source_url="https://example.org/data/outreach-test",
        topics=("Outreach test topic",),
        expeditions=("climate",),
    )

    result = _draft("dataset", dataset_id, "student", "short_explanation")

    assert result["warnings"] == []
    assert "Note" not in _headings(result)
    assert "Demo / Prototype Data" not in result["draft"]["text"]
    assert "not yet been marked Verified" not in result["draft"]["text"]
    assert "Verification status: Verified" in _section(result, "Sources")


def test_source_details_and_citation_match_the_repository(make_dataset) -> None:
    dataset_id = make_dataset(
        title="Outreach citation dataset",
        description="Stored description for the citation test.",
        verification_status="verified",
        source_url="https://example.org/data/outreach-test",
        file_type="csv",
        topics=("Outreach citation topic",),
        expeditions=("climate",),
    )
    climate = DEMO_IDS["expeditions"]["climate"]

    result = _draft("dataset", dataset_id, "public", "short_explanation")

    source = result["source"]
    assert source["title"] == "Outreach citation dataset"
    assert source["type_label"] == "Dataset"
    assert source["summary"] == "Stored description for the citation test."
    assert source["source_url"] == "https://example.org/data/outreach-test"
    assert source["href"] == f"/datasets/{dataset_id}"
    assert source["facts"] == [
        {"label": "Data file", "value": "CSV file"},
        {"label": "Research topics", "value": "Outreach citation topic"},
        {"label": "Related expeditions", "value": "Demo Antarctic Climate Expedition"},
    ]
    assert source["topics"] == [
        {
            "name": "Outreach citation topic",
            "description": "Stored description of Outreach citation topic.",
        }
    ]
    assert source["related_resources"] == [
        {
            "id": climate,
            "type": "expedition",
            "title": "Demo Antarctic Climate Expedition",
            "href": f"/expeditions/{climate}",
        }
    ]

    sources = _section(result, "Sources")
    assert "Outreach citation dataset (Dataset). DhruvSetu repository." in sources
    assert "Verification status: Verified" in sources
    assert f"DhruvSetu page: /datasets/{dataset_id}" in sources
    assert "Original source: https://example.org/data/outreach-test" in sources


def test_missing_optional_information_gives_a_short_draft(make_dataset) -> None:
    dataset_id = make_dataset(title="Outreach bare dataset", verification_status="verified")

    result = _draft("dataset", dataset_id, "student", "short_explanation")
    full = _draft("expedition", SEA_ICE_EXPEDITION, "student", "short_explanation")

    assert result["source"]["summary"] is None
    assert result["source"]["source_url"] is None
    assert result["source"]["related_resources"] == []
    assert result["source"]["facts"] == [
        {"label": "Data file", "value": "Metadata only, no data file"}
    ]
    assert [warning["code"] for warning in result["warnings"]] == ["limited_information"]
    text = result["draft"]["text"]
    assert "None" not in text and "null" not in text
    assert "Original source" not in text
    assert "The repository describes it" not in text
    assert len(text) < len(full["draft"]["text"])


def test_drafts_add_no_dates_people_or_importance_claims(make_dataset) -> None:
    dataset_id = make_dataset(
        title="Outreach plain dataset",
        description="Stored description without any figures.",
        verification_status="verified",
    )

    for audience in AUDIENCES:
        for format in FORMATS:
            result = _draft("dataset", dataset_id, audience, format)
            body = result["draft"]["text"].replace(dataset_id, "")
            # The record holds no numbers, people, dates or topics, so none appear.
            assert re.search(r"\d", body) is None, (audience, format)
            assert "Scientists" not in body
            assert "Year" not in body and "date" not in body.lower()
            assert "Why it matters" not in body
            assert "Research topics" not in body


def test_why_it_matters_only_uses_stored_topic_descriptions(make_dataset) -> None:
    with_topics = make_dataset(
        title="Outreach topic dataset",
        description="Stored description.",
        verification_status="verified",
        topics=("Outreach importance topic",),
    )
    without_topics = make_dataset(
        title="Outreach no topic dataset",
        description="Stored description.",
        verification_status="verified",
    )

    described = _draft("dataset", with_topics, "journalist", "news_brief")
    plain = _draft("dataset", without_topics, "journalist", "news_brief")
    demo = _draft("expedition", SEA_ICE_EXPEDITION, "journalist", "news_brief")

    assert _section(described, "Why it matters") == (
        "The repository links this dataset to these research topics:\n"
        '- Outreach importance topic: "Stored description of Outreach importance topic."'
    )
    assert "Why it matters" not in _headings(plain)
    # Demo records never get an importance section.
    assert "Why it matters" not in _headings(demo)


def test_document_drafts_do_not_reveal_document_text() -> None:
    document_id = _document_id("Demo Antarctic Climate Field Notes")

    for format in FORMATS:
        result = _draft("document", document_id, "teacher", format)
        text = result["draft"]["text"]
        # Phrases that only exist inside the stored document file.
        assert "air temperature" not in text
        assert "fictional prototype content" not in text
        assert "demo field team" not in text
    assert result["source"]["summary"] is None
    assert {"label": "Document type", "value": "TXT document"} in result["source"]["facts"]
    assert {
        "label": "Related report",
        "value": "Demo Antarctic Climate Expedition Report",
    } in result["source"]["facts"]


def test_formats_have_different_structures() -> None:
    explanation = _draft("expedition", SEA_ICE_EXPEDITION, "student", "short_explanation")
    brief = _draft("expedition", SEA_ICE_EXPEDITION, "journalist", "news_brief")
    note = _draft("expedition", SEA_ICE_EXPEDITION, "teacher", "classroom_note")
    post = _draft("expedition", SEA_ICE_EXPEDITION, "public", "social_post")

    assert _headings(explanation) == [
        "Note",
        "Short explanation",
        "Key points",
        "Important terms",
        "Sources",
    ]
    assert _headings(brief) == ["Note", "Headline", "Context", "Key repository facts", "Sources"]
    assert _headings(note) == [
        "Note",
        "Topic",
        "Learning objective",
        "Explanation",
        "Key points",
        "Discussion questions",
        "Sources",
    ]
    assert _headings(post) == ["Post", "Sources"]
    assert len(_section(post, "Post")) <= SOCIAL_POST_LIMIT
    assert "#" not in _section(post, "Post")


def test_audience_changes_the_wording() -> None:
    drafts = {
        audience: _draft("expedition", SEA_ICE_EXPEDITION, audience, "short_explanation")
        for audience in AUDIENCES
    }

    texts = {audience: result["draft"]["text"] for audience, result in drafts.items()}
    assert len(set(texts.values())) == 4
    # Only students get the list of terms.
    assert "Important terms" in _headings(drafts["student"])
    for audience in ("teacher", "journalist", "public"):
        assert "Important terms" not in _headings(drafts[audience])
    assert "Expedition: an organised journey made for research." in texts["student"]
    # Journalists get the source status in the opening lines.
    assert "Its verification status is Uploaded." in _section(
        drafts["journalist"], "Short explanation"
    )
    # Teachers get a question about how far the source has been checked.
    teacher_note = _draft("expedition", SEA_ICE_EXPEDITION, "teacher", "classroom_note")
    student_note = _draft("expedition", SEA_ICE_EXPEDITION, "student", "classroom_note")
    assert "how far a source has been checked" in _section(teacher_note, "Discussion questions")
    assert "how far a source has been checked" not in student_note["draft"]["text"]
    assert _section(teacher_note, "Learning objective") != _section(
        student_note, "Learning objective"
    )


def test_generation_is_deterministic() -> None:
    first = _draft("publication", DEMO_IDS["publications"]["sea-ice"], "journalist", "news_brief")
    second = _draft("publication", DEMO_IDS["publications"]["sea-ice"], "journalist", "news_brief")

    assert first == second


def test_long_descriptions_keep_the_social_post_short(make_dataset) -> None:
    dataset_id = make_dataset(
        title="Outreach long dataset",
        description="First stored sentence. " + "Another stored sentence that goes on. " * 30,
        verification_status="verified",
    )

    post = _section(_draft("dataset", dataset_id, "public", "social_post"), "Post")

    assert len(post) <= SOCIAL_POST_LIMIT
    assert "First stored sentence." in post
    assert post.endswith("Source: DhruvSetu.")


def test_source_selector_lists_and_searches_records() -> None:
    expeditions = client.get("/api/outreach/sources", params={"type": "expedition"})
    searched = client.get("/api/outreach/sources", params={"type": "expedition", "q": "SEA ICE"})
    documents = client.get("/api/outreach/sources", params={"type": "document", "q": "biodiversity"})
    nothing = client.get("/api/outreach/sources", params={"type": "report", "q": "no-such-record-xyz"})

    assert expeditions.status_code == 200
    assert set(DEMO_IDS["expeditions"].values()) <= {item["id"] for item in expeditions.json()}
    assert searched.json() == [
        {
            "resource_type": "expedition",
            "id": SEA_ICE_EXPEDITION,
            "title": "Demo Sea Ice Observation Expedition",
            "verification_status": "uploaded",
            "is_demo_data": True,
        }
    ]
    assert [item["title"] for item in documents.json()] == [
        "Prototype Polar Biodiversity Field Guide Notes"
    ]
    assert nothing.json() == []
    assert client.get("/api/outreach/sources", params={"type": "scientist"}).status_code == 422
    assert client.get("/api/outreach/sources").status_code == 422


def test_source_summary_is_available_before_generating() -> None:
    response = client.get(f"/api/outreach/sources/expedition/{SEA_ICE_EXPEDITION}")
    missing = client.get(
        "/api/outreach/sources/expedition/00000000-0000-0000-0000-000000000000"
    )

    assert response.status_code == 200
    source = response.json()
    assert source["title"] == "Demo Sea Ice Observation Expedition"
    assert source["type_label"] == "Expedition"
    assert source["href"] == f"/expeditions/{SEA_ICE_EXPEDITION}"
    assert [warning["code"] for warning in source["warnings"]] == ["demo_data", "not_verified"]
    # Media records linked to the expedition are listed as references only.
    assert {"title": "Demo Sea Ice Field Photo", "media_type": "image"} in source["media"]
    assert missing.status_code == 404
    assert client.get(f"/api/outreach/sources/scientist/{SEA_ICE_EXPEDITION}").status_code == 422
