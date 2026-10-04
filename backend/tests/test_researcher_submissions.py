from functools import partial
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.datasets import files as dataset_files
from app.ingestion.service import ingest_document
from app.main import app
from app.models import Dataset, Document, Expedition, ResearchTopic, VerificationChange
from app.researcher import submissions
from conftest import log_in

DOCUMENTS_URL = "/api/researcher/documents"
DATASETS_URL = "/api/researcher/datasets"
SUBMISSIONS_URL = "/api/researcher/submissions"

CSV = b"sample_number,demo_value\n1,2.5\n2,3.5\n3,4.0\n"


def _text() -> bytes:
    # Every test document is different, so none counts as a copy of another.
    return (
        "Prototype test notes for the researcher submission workflow. "
        f"Reference {uuid4().hex}. This text is not a real scientific source."
    ).encode()


@pytest.fixture
def stores(tmp_path, monkeypatch):
    """Send submitted files to a temporary folder instead of the real stores."""
    documents = tmp_path / "documents"
    datasets = tmp_path / "datasets"
    monkeypatch.setattr(
        submissions, "ingest_document", partial(ingest_document, document_store=documents)
    )
    monkeypatch.setattr(dataset_files, "DATASET_STORE", datasets)
    return type("Stores", (), {"documents": documents, "datasets": datasets, "root": tmp_path})


@pytest.fixture
def signed_in(client_as, stores):
    """Clients for test accounts. What they submitted is removed afterwards."""
    clients: list[TestClient] = []

    def create(role: str) -> TestClient:
        client = client_as(role)
        clients.append(client)
        return client

    yield create

    ids = [client.user.id for client in clients]
    with SessionLocal() as session:
        for model, record_type in ((Document, "document"), (Dataset, "dataset")):
            found = session.scalars(
                select(model.id).where(model.submitted_by_user_id.in_(ids))
            ).all()
            session.execute(
                delete(VerificationChange).where(
                    VerificationChange.record_type == record_type,
                    VerificationChange.record_id.in_(found),
                )
            )
            for record in session.scalars(select(model).where(model.id.in_(found))):
                session.delete(record)
        session.commit()


def _submit_document(client: TestClient, *, name="field-notes.txt", content=None, **fields):
    data = {"title": "Prototype Test Field Notes", "document_type": "field_notes", **fields}
    return client.post(
        DOCUMENTS_URL,
        data=data,
        files={"file": (name, _text() if content is None else content, "text/plain")},
    )


def _submit_dataset(client: TestClient, *, name="samples.csv", content=CSV, **fields):
    data = {"title": "Prototype Test Dataset", **fields}
    return client.post(
        DATASETS_URL, data=data, files={"file": (name, content, "text/csv")}
    )


def _document(document_id: str) -> Document:
    with SessionLocal() as session:
        return session.get(Document, document_id)


def _dataset(dataset_id: str) -> Dataset:
    with SessionLocal() as session:
        return session.get(Dataset, dataset_id)


def _files_in(folder: Path) -> list[str]:
    return sorted(item.name for item in folder.iterdir()) if folder.exists() else []


@pytest.mark.parametrize("url", [DOCUMENTS_URL, DATASETS_URL])
def test_only_researchers_and_admins_can_submit(signed_in, stores, url) -> None:
    files = {"file": ("notes.txt", _text(), "text/plain")}
    data = {"title": "Not allowed", "document_type": "report"}
    anonymous = TestClient(app)
    user = signed_in("user")

    assert anonymous.post(url, data=data, files=files).status_code == 401
    assert anonymous.get(SUBMISSIONS_URL).status_code == 401
    refused = user.post(url, data=data, files=files)

    assert refused.status_code == 403
    assert user.get(SUBMISSIONS_URL).status_code == 403
    assert _files_in(stores.documents) == [] and _files_in(stores.datasets) == []


def test_researcher_can_submit_a_document(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    with SessionLocal() as session:
        expedition = session.scalar(select(Expedition).order_by(Expedition.name))

    response = _submit_document(
        researcher,
        title="  Prototype Test Field Notes  ",
        source_url="https://example.org/notes",
        publication_date="2026-01-15",
        expedition_id=expedition.id,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "document"
    assert body["title"] == "Prototype Test Field Notes"
    assert body["verification_status"] == "uploaded"
    assert body["href"] == f"/documents/{body['id']}"

    saved = _document(body["id"])
    assert saved.verification_status == "uploaded"
    assert saved.is_demo_data is False
    assert saved.submitted_by_user_id == researcher.user.id
    assert saved.source_type == "field_notes"
    assert saved.source_url == "https://example.org/notes"
    assert saved.expedition_id == expedition.id
    assert saved.file_name == "field-notes.txt"
    # The usual ingestion ran: the text is stored as chunks for search.
    with SessionLocal() as session:
        assert len(session.get(Document, body["id"]).chunks) >= 1
    assert _files_in(stores.documents) == [f"{saved.file_hash}.txt"]

    # The public page names the submitter, and nothing else about the account.
    public = TestClient(app).get(f"/api/documents/{body['id']}")
    assert public.status_code == 200
    assert public.json()["submitted_by"] == "Test Researcher"
    assert public.json()["verification_status"] == "uploaded"
    assert public.json()["is_demo_data"] is False
    assert researcher.user.email not in public.text
    assert researcher.user.id not in public.text
    assert researcher.get(SUBMISSIONS_URL).json() == [body]


def test_researcher_can_submit_a_dataset(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    with SessionLocal() as session:
        expedition = session.scalar(select(Expedition).order_by(Expedition.name))
        topic = session.scalar(select(ResearchTopic).order_by(ResearchTopic.name))

    response = _submit_dataset(
        researcher,
        description="Three prototype rows for testing.",
        source_url="https://example.org/data",
        expedition_id=expedition.id,
        topic_id=topic.id,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "dataset"
    assert body["verification_status"] == "uploaded"
    assert body["file_type"] == "csv"

    saved = _dataset(body["id"])
    assert saved.verification_status == "uploaded"
    assert saved.is_demo_data is False
    assert saved.submitted_by_user_id == researcher.user.id
    assert saved.description == "Three prototype rows for testing."
    # The file is stored under a name made by the server.
    assert saved.file_name == f"{saved.id}.csv"
    assert _files_in(stores.datasets) == [f"{saved.id}.csv"]

    public = TestClient(app)
    detail = public.get(f"/api/datasets/{body['id']}")
    assert detail.json()["submitted_by"] == "Test Researcher"
    assert detail.json()["related_resources"][0]["id"] == expedition.id
    assert detail.json()["research_topics"][0]["id"] == topic.id
    assert researcher.user.email not in detail.text
    # It opens in the Dataset Explorer like any other dataset.
    preview = public.get(f"/api/datasets/{body['id']}/preview")
    assert preview.status_code == 200
    assert public.get(f"/api/datasets/{body['id']}/download").content == CSV
    assert [item["id"] for item in researcher.get(SUBMISSIONS_URL).json()] == [body["id"]]


def test_an_admin_can_submit_too(signed_in, stores) -> None:
    admin = signed_in("admin")

    response = _submit_document(admin)

    assert response.status_code == 201
    assert _document(response.json()["id"]).submitted_by_user_id == admin.user.id


@pytest.mark.parametrize(
    "extra",
    [
        {"verification_status": "verified"},
        {"verification_status": "reviewed"},
        {"status": "verified"},
        {"is_demo_data": "true"},
        {"submitted_by_user_id": "another-account"},
        {"submitted_by": "Somebody Else"},
    ],
)
def test_a_submission_cannot_set_its_status_or_owner(signed_in, stores, extra) -> None:
    researcher = signed_in("researcher")

    document = _submit_document(researcher, **extra)
    dataset = _submit_dataset(researcher, **extra)

    assert document.status_code == 422
    assert dataset.status_code == 422
    assert researcher.get(SUBMISSIONS_URL).json() == []
    assert _files_in(stores.documents) == [] and _files_in(stores.datasets) == []


def test_a_researcher_cannot_review_or_verify_their_own_submission(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    document_id = _submit_document(researcher).json()["id"]
    dataset_id = _submit_dataset(researcher).json()["id"]

    for record_type, record_id in (("document", document_id), ("dataset", dataset_id)):
        for status in ("reviewed", "verified"):
            response = researcher.patch(
                f"/api/admin/records/{record_type}/{record_id}/verification",
                json={"status": status},
            )
            assert response.status_code == 403
    assert researcher.get("/api/admin/records").status_code == 403
    assert _document(document_id).verification_status == "uploaded"
    assert _dataset(dataset_id).verification_status == "uploaded"


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("paper.docx", b"PK not a supported document", "Only PDF and TXT documents are supported."),
        ("tool.exe", b"MZ not a document", "Only PDF and TXT documents are supported."),
        ("page.html", b"<script>alert(1)</script>", "Only PDF and TXT documents are supported."),
        ("fake.pdf", b"This is not a PDF.", "The file does not contain a valid PDF header."),
        ("fake.txt", b"%PDF-1.7 pretending to be text", "The file content does not match its TXT extension."),
        ("binary.txt", b"text\x00with binary", "The TXT file contains binary data."),
        ("blank.txt", b"   \n  ", "The document has no extractable text."),
        ("noextension", b"some text", "The file needs a name with a file type, for example notes.pdf."),
        (".txt", b"some text", "The file needs a name with a file type, for example notes.pdf."),
    ],
)
def test_unsupported_documents_are_refused(signed_in, stores, name, content, message) -> None:
    researcher = signed_in("researcher")

    response = _submit_document(researcher, name=name, content=content)

    assert response.status_code == 422
    assert response.json() == {"detail": message}
    assert researcher.get(SUBMISSIONS_URL).json() == []
    assert _files_in(stores.documents) == []


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("data.zip", b"PK\x03\x04", "Only CSV and JSON data files can be submitted."),
        ("data.xlsx", b"PK\x03\x04", "Only CSV and JSON data files can be submitted."),
        ("data.txt", b"a,b\n1,2\n", "Only CSV and JSON data files can be submitted."),
        ("data.csv", b"a,b\n\x00\x01", "The file is not a readable text file."),
        ("data.csv", b"only_a_header\n", "The CSV file has no data rows."),
        ("data.json", b"{not json", "The file is not valid JSON."),
        ("data.json", b'{"a": 1}', "The JSON file must contain a list of records."),
    ],
)
def test_unsupported_datasets_are_refused(signed_in, stores, name, content, message) -> None:
    researcher = signed_in("researcher")

    response = _submit_dataset(researcher, name=name, content=content)

    assert response.status_code == 422
    assert response.json() == {"detail": message}
    assert researcher.get(SUBMISSIONS_URL).json() == []
    assert _files_in(stores.datasets) == []


@pytest.mark.parametrize(
    "name",
    ["../../outside.txt", "..\\..\\outside.txt", "/etc/outside.txt", "folder/../outside.txt"],
)
def test_file_names_cannot_leave_the_store(signed_in, stores, name) -> None:
    researcher = signed_in("researcher")

    document = _submit_document(researcher, name=name)
    dataset = _submit_dataset(researcher, name=name.replace(".txt", ".csv"))

    assert document.status_code == 201 and dataset.status_code == 201
    saved_document = _document(document.json()["id"])
    saved_dataset = _dataset(dataset.json()["id"])
    # Only the plain name is kept as a label. Stored names are made by the server.
    assert saved_document.file_name == "outside.txt"
    assert Path(saved_document.file_path).parent == stores.documents
    assert _files_in(stores.documents) == [f"{saved_document.file_hash}.txt"]
    assert _files_in(stores.datasets) == [f"{saved_dataset.id}.csv"]
    assert sorted(item.name for item in stores.root.iterdir()) == ["datasets", "documents"]
    assert not list(stores.root.parent.glob("outside.*"))


def test_files_over_the_size_limit_are_refused(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    row = b"1,2.5\n"
    large_csv = b"a,b\n" + row * (submissions.MAX_DATASET_BYTES // len(row) + 10)
    large_text = b"word " * (submissions.MAX_DOCUMENT_BYTES // 5 + 100)

    dataset = _submit_dataset(researcher, content=large_csv)
    document = _submit_document(researcher, content=large_text)

    assert dataset.status_code == 413
    assert dataset.json() == {"detail": "The file is larger than 5 MB."}
    assert document.status_code == 413
    assert document.json() == {"detail": "The file is larger than 20 MB."}
    assert researcher.get(SUBMISSIONS_URL).json() == []
    assert _files_in(stores.documents) == [] and _files_in(stores.datasets) == []


def test_incomplete_uploads_are_refused(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    data = {"title": "Prototype Test Field Notes", "document_type": "field_notes"}

    no_file = researcher.post(DOCUMENTS_URL, data=data, files={"other": ("a.txt", b"x")})
    empty_file = _submit_document(researcher, content=b"")
    as_json = researcher.post(DOCUMENTS_URL, json=data)
    two_files = researcher.post(
        DOCUMENTS_URL,
        data=data,
        files=[("file", ("a.txt", _text())), ("file", ("b.txt", _text()))],
    )
    no_title = _submit_document(researcher, title="  ")
    bad_type = _submit_document(researcher, document_type="press_release")
    bad_url = _submit_document(researcher, source_url="javascript:alert(1)")
    future = _submit_document(researcher, publication_date="2999-01-01")
    bad_expedition = _submit_document(researcher, expedition_id="not-an-expedition")

    assert no_file.status_code == 422
    assert empty_file.json() == {"detail": "The file is empty."}
    assert as_json.status_code == 415
    assert two_files.status_code == 422
    assert [reply.status_code for reply in (no_title, bad_type, bad_url, future)] == [422] * 4
    assert bad_expedition.json() == {"detail": "The related expedition was not found."}
    assert researcher.get(SUBMISSIONS_URL).json() == []
    assert _files_in(stores.documents) == []


def test_the_same_document_is_not_stored_twice(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    content = _text()
    assert _submit_document(researcher, content=content).status_code == 201

    again = _submit_document(researcher, content=content, title="A second copy")

    assert again.status_code == 409
    assert again.json() == {"detail": "This document is already in the repository."}
    assert len(researcher.get(SUBMISSIONS_URL).json()) == 1


def test_each_researcher_sees_only_their_own_submissions(signed_in, stores) -> None:
    first = signed_in("researcher")
    second = signed_in("researcher")
    first_id = _submit_document(first).json()["id"]
    second_id = _submit_dataset(second).json()["id"]

    assert [item["id"] for item in first.get(SUBMISSIONS_URL).json()] == [first_id]
    assert [item["id"] for item in second.get(SUBMISSIONS_URL).json()] == [second_id]


def test_admin_verifies_a_submission_with_the_usual_workflow(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    admin = signed_in("admin")
    document_id = _submit_document(researcher).json()["id"]
    dataset_id = _submit_dataset(researcher).json()["id"]

    for record_type, record_id in (("document", document_id), ("dataset", dataset_id)):
        url = f"/api/admin/records/{record_type}/{record_id}"
        # The submission waits in the same queue as every other record.
        queue = admin.get(f"/api/admin/records?status=uploaded&type={record_type}").json()
        assert record_id in [item["id"] for item in queue]

        detail = admin.get(url).json()
        facts = {fact["label"]: fact["value"] for fact in detail["facts"]}
        assert facts["Submitted by"] == f"Test Researcher ({researcher.user.email})"
        assert facts["Submitter role now"] == "Researcher"
        assert "Submitted on" in facts
        assert detail["is_demo_data"] is False

        # A step cannot be skipped, exactly as before.
        skipped = admin.patch(f"{url}/verification", json={"status": "verified"})
        assert skipped.status_code == 409
        assert admin.patch(f"{url}/verification", json={"status": "reviewed"}).status_code == 200
        verified = admin.patch(f"{url}/verification", json={"status": "verified"})
        assert verified.status_code == 200

        # Stored facts give the trail: who submitted it and who changed its status.
        trail = verified.json()
        assert sorted((item["from_status"], item["to_status"]) for item in trail["changes"]) == [
            ("reviewed", "verified"),
            ("uploaded", "reviewed"),
        ]
        assert {item["changed_by"] for item in trail["changes"]} == {"Test Admin"}
        assert {fact["label"]: fact["value"] for fact in trail["facts"]}[
            "Submitted by"
        ] == f"Test Researcher ({researcher.user.email})"

    public = TestClient(app)
    document = public.get(f"/api/documents/{document_id}").json()
    dataset = public.get(f"/api/datasets/{dataset_id}").json()
    assert document["verification_status"] == dataset["verification_status"] == "verified"
    # Verifying a record does not change who submitted it.
    assert document["submitted_by"] == dataset["submitted_by"] == "Test Researcher"
    assert _document(document_id).submitted_by_user_id == researcher.user.id
    assert [item["verification_status"] for item in researcher.get(SUBMISSIONS_URL).json()] == [
        "verified",
        "verified",
    ]


def test_records_stay_when_the_researcher_role_is_removed(signed_in, stores) -> None:
    researcher = signed_in("researcher")
    admin = signed_in("admin")
    document_id = _submit_document(researcher).json()["id"]
    url = f"/api/admin/records/document/{document_id}/verification"
    assert admin.patch(url, json={"status": "reviewed"}).status_code == 200
    assert admin.patch(url, json={"status": "verified"}).status_code == 200

    demoted = admin.patch(
        f"/api/admin/users/{researcher.user.id}/role", json={"role": "user"}
    )

    assert demoted.status_code == 200
    assert log_in(researcher, researcher.user).json()["role"] == "user"
    assert researcher.get(SUBMISSIONS_URL).status_code == 403
    assert _submit_document(researcher).status_code == 403
    saved = _document(document_id)
    assert saved.verification_status == "verified"
    assert saved.submitted_by_user_id == researcher.user.id
    public = TestClient(app).get(f"/api/documents/{document_id}").json()
    assert public["submitted_by"] == "Test Researcher"
    facts = {
        fact["label"]: fact["value"]
        for fact in admin.get(f"/api/admin/records/document/{document_id}").json()["facts"]
    }
    assert facts["Submitter role now"] == "User"


def test_project_records_have_no_submitter() -> None:
    public = TestClient(app)
    document = public.get("/api/documents").json()[0]
    dataset = public.get("/api/datasets").json()[0]

    assert public.get(f"/api/documents/{document['id']}").json()["submitted_by"] is None
    assert public.get(f"/api/datasets/{dataset['id']}").json()["submitted_by"] is None
