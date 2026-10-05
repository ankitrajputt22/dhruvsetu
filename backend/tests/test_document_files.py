"""Opening and downloading the stored file of a document.

The tests use a temporary document store. Nothing is read from or written to
the real one.
"""
from functools import partial
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import api, reference_data
from app.database import SessionLocal
from app.ingestion import files
from app.ingestion.service import ingest_document
from app.main import app
from app.models import Document
from app.researcher import submissions
from test_document_ingestion import _delete_test_document, _file_hash, _write_text_pdf
from test_researcher_submissions import signed_in, stores  # noqa: F401

client = TestClient(app)

TEXT = (
    "Document preview test notes.\n"
    "\n"
    "Second paragraph, kept on its own line.\n"
    "<script>alert('not run')</script>\n"
)


@pytest.fixture
def store(tmp_path, monkeypatch) -> Path:
    folder = tmp_path / "documents"
    folder.mkdir()
    monkeypatch.setattr(files, "DOCUMENT_STORE", folder)
    return folder


@pytest.fixture
def make_document(store, tmp_path):
    """Ingest a test file into the temporary store. Removed afterwards."""
    hashes: list[str] = []

    def create(name: str, content: bytes | None = None, pages: list[str] | None = None) -> str:
        source = tmp_path / "incoming" / name
        source.parent.mkdir(exist_ok=True)
        if pages is not None:
            _write_text_pdf(source, pages)
        else:
            # Every test file is different, so none counts as a copy of another.
            source.write_bytes(content or (TEXT + f"Reference {uuid4().hex}.\n").encode())
        digest = _file_hash(source)
        hashes.append(digest)
        _delete_test_document(digest)
        with SessionLocal() as session:
            result = ingest_document(
                session,
                source,
                title=f"Test preview document {name}",
                is_demo_data=True,
                document_store=store,
            )
            return result.document.id

    try:
        yield create
    finally:
        for digest in hashes:
            _delete_test_document(digest)


def _stored(document_id: str) -> Document:
    with SessionLocal() as session:
        return session.get(Document, document_id)


def _record(file_path: str, file_type: str, file_name: str = "notes.txt") -> Document:
    """A record that exists only in memory, for checking what it can reach."""
    return Document(file_path=file_path, file_type=file_type, file_name=file_name)


def test_txt_document_is_served_as_plain_text(make_document) -> None:
    document_id = make_document("field-notes.txt")
    stored = Path(_stored(document_id).file_path)

    response = client.get(f"/api/documents/{document_id}/file")

    assert response.status_code == 200
    # The real file, byte for byte. Nothing is rebuilt from search chunks.
    assert response.content == stored.read_bytes()
    assert response.text.startswith(TEXT)
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
    assert response.headers["content-disposition"] == 'inline; filename="field-notes.txt"'
    # Never treated as a web page, whatever the text contains.
    assert response.headers["x-content-type-options"] == "nosniff"


def test_pdf_document_is_served_as_pdf(make_document) -> None:
    document_id = make_document("report.pdf", pages=["Page one of the test PDF.", "Page two."])
    stored = Path(_stored(document_id).file_path)

    response = client.get(f"/api/documents/{document_id}/file")

    assert response.status_code == 200
    assert response.content == stored.read_bytes()
    assert response.content.startswith(b"%PDF-")
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == 'inline; filename="report.pdf"'
    assert response.headers["x-content-type-options"] == "nosniff"


def test_download_sends_the_same_file_as_an_attachment(make_document) -> None:
    document_id = make_document("field-notes.txt")

    opened = client.get(f"/api/documents/{document_id}/file")
    downloaded = client.get(f"/api/documents/{document_id}/download")

    assert downloaded.status_code == 200
    assert downloaded.content == opened.content
    assert downloaded.headers["content-type"] == "text/plain; charset=utf-8"
    assert downloaded.headers["content-disposition"] == 'attachment; filename="field-notes.txt"'


def test_document_detail_describes_the_stored_file(make_document, monkeypatch) -> None:
    document_id = make_document("field-notes.txt")
    size = Path(_stored(document_id).file_path).stat().st_size

    detail = client.get(f"/api/documents/{document_id}").json()

    assert detail["file"] == {
        "file_name": "field-notes.txt",
        "file_type": "txt",
        "size_bytes": size,
        "available": True,
        "previewable": True,
        "preview_message": None,
    }
    # No path on the server is ever sent.
    assert "file_path" not in detail and "file_hash" not in detail
    assert "/" not in detail["file"]["file_name"]

    # A very long text file can be opened, but is not shown inside the page.
    monkeypatch.setattr(api, "TEXT_PREVIEW_BYTES", 10)
    large = client.get(f"/api/documents/{document_id}").json()["file"]
    assert (large["available"], large["previewable"]) == (True, False)
    assert large["preview_message"] == files.TEXT_TOO_LARGE


def test_unknown_document_has_no_file() -> None:
    for action in ("file", "download"):
        response = client.get(f"/api/documents/not-a-real-document/{action}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Document not found"}


def test_record_whose_file_is_gone_is_reported_safely(make_document) -> None:
    document_id = make_document("field-notes.txt")
    stored = Path(_stored(document_id).file_path)
    stored.unlink()

    detail = client.get(f"/api/documents/{document_id}")
    opened = client.get(f"/api/documents/{document_id}/file")
    downloaded = client.get(f"/api/documents/{document_id}/download")

    # The record, its source and its links are still there.
    assert detail.status_code == 200
    body = detail.json()
    assert body["title"] == "Test preview document field-notes.txt"
    assert body["file"] == {
        "file_name": "field-notes.txt",
        "file_type": "txt",
        "size_bytes": None,
        "available": False,
        "previewable": False,
        "preview_message": "The stored file for this document is currently unavailable.",
    }
    for response in (opened, downloaded):
        assert response.status_code == 404
        assert response.json() == {
            "detail": "The stored file for this document is currently unavailable."
        }
        # The message does not say where the file was expected.
        assert str(stored.parent) not in response.text


def test_a_request_cannot_name_a_file_or_a_path(make_document) -> None:
    document_id = make_document("field-notes.txt")
    expected = Path(_stored(document_id).file_path).read_bytes()

    # A path instead of an ID finds nothing.
    for attempt in (
        "..%2F..%2Fetc%2Fpasswd",
        "%2Fetc%2Fpasswd",
        "..%2Falembic.ini",
        f"{document_id}%2F..%2F..%2F.env",
    ):
        assert client.get(f"/api/documents/{attempt}/file").status_code == 404
    assert client.get("/api/documents/../../etc/passwd/file").status_code == 404

    # Extra parameters are ignored: only the record decides which file is sent.
    response = client.get(
        f"/api/documents/{document_id}/file",
        params={"path": "/etc/passwd", "file": "../../.env", "name": "alembic.ini"},
    )
    assert response.status_code == 200
    assert response.content == expected
    assert "field-notes.txt" in response.headers["content-disposition"]


def test_a_record_cannot_point_outside_the_document_store(store, tmp_path) -> None:
    (store / "inside.txt").write_text("inside the store", encoding="utf-8")
    outside = tmp_path / "secret.txt"
    outside.write_text("outside the store", encoding="utf-8")
    nested = store / "nested"
    nested.mkdir()
    (nested / "deep.txt").write_text("in a folder of the store", encoding="utf-8")
    (store / "link.txt").symlink_to(outside)

    assert files.find_document_file(_record(str(store / "inside.txt"), "txt")) is not None

    for path in (
        str(outside),
        str(store / ".." / "secret.txt"),
        "../secret.txt",
        "data/documents/../../alembic.ini",
        "/etc/passwd",
        "/etc/hosts.txt",
        str(nested / "deep.txt"),
        # A link in the store that leads out of it.
        str(store / "link.txt"),
        f"{store}\\inside.txt",
        str(store),
        "",
        "   ",
    ):
        assert files.find_document_file(_record(path, "txt")) is None, path


def test_only_pdf_and_txt_files_are_ever_served(store) -> None:
    for name in ("notes.docx", "page.html", "table.csv", "archive.zip", "script.py", "noextension"):
        (store / name).write_bytes(b"not a document type that is served")
        file_type = name.rpartition(".")[2]
        assert files.find_document_file(_record(str(store / name), file_type, name)) is None, name

    # A hidden file, and a file whose type does not match its record.
    (store / ".env.txt").write_text("SECRET=1", encoding="utf-8")
    assert files.find_document_file(_record(str(store / ".env.txt"), "txt")) is None
    (store / "notes.txt").write_text("plain notes", encoding="utf-8")
    assert files.find_document_file(_record(str(store / "notes.txt"), "pdf")) is None
    # A file named .pdf that is not a PDF is not sent as one.
    (store / "fake.pdf").write_bytes(b"<html>not a pdf</html>")
    assert files.find_document_file(_record(str(store / "fake.pdf"), "pdf", "fake.pdf")) is None

    # The detail says a type is not previewed, and that it holds no copy when
    # the record names no file.
    assert api._document_file_info(_record(str(store / "notes.docx"), "docx", "notes.docx")).model_dump() == {
        "file_name": "notes.docx",
        "file_type": "docx",
        "size_bytes": None,
        "available": False,
        "previewable": False,
        "preview_message": "Preview is not available for this file type.",
    }
    assert api._document_file_info(_record("", "pdf")) is None


def test_download_name_is_a_plain_name(store) -> None:
    (store / "abc123.txt").write_text("notes", encoding="utf-8")

    def name(recorded: str) -> str:
        return files.find_document_file(_record(str(store / "abc123.txt"), "txt", recorded)).file_name

    assert name("Field Notes 2024.txt") == "Field Notes 2024.txt"
    assert name("../../etc/passwd.txt") == "passwd.txt"
    assert name('bad"name\r\n.txt') == "badname.txt"
    # A label without the right ending is replaced, never trusted.
    assert name("report.exe") == "document.txt"
    assert name("") == "document.txt"


def test_document_list_and_detail_keep_their_shape(make_document) -> None:
    document_id = make_document("field-notes.txt")

    listed = next(item for item in client.get("/api/documents").json() if item["id"] == document_id)
    detail = client.get(f"/api/documents/{document_id}").json()

    # The list is unchanged. The detail only gained the file description.
    assert set(listed) == {
        "id", "title", "file_type", "file_name", "source_type", "source_url",
        "publication_date", "verification_status", "is_demo_data",
        "related_resources", "chunk_count",
    }
    assert set(detail) == set(listed) | {
        "created_at", "first_page", "last_page", "submitted_by", "file",
    }
    for hidden in ("file_path", "file_hash", "chunks", "text"):
        assert hidden not in detail


def test_a_researcher_upload_can_be_opened_and_is_left_as_it_was(
    signed_in, stores, monkeypatch  # noqa: F811
) -> None:
    monkeypatch.setattr(files, "DOCUMENT_STORE", stores.documents)
    monkeypatch.setattr(
        submissions,
        "ingest_document",
        partial(ingest_document, document_store=stores.documents),
    )
    researcher = signed_in("researcher")
    content = f"Researcher field notes for the preview test.\nReference {uuid4().hex}.\n".encode()

    created = researcher.post(
        "/api/researcher/documents",
        data={"title": "Prototype Test Upload For Preview", "document_type": "field_notes"},
        files={"file": ("../../my-notes.txt", content, "text/plain")},
    )
    assert created.status_code == 201, created.text
    document_id = created.json()["id"]

    # Anyone who can see the record can read its file.
    response = TestClient(app).get(f"/api/documents/{document_id}/file")
    assert response.status_code == 200
    assert response.content == content
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
    # The uploader's own name is only a label. The file is stored under a
    # name made by the server.
    assert response.headers["content-disposition"] == 'inline; filename="my-notes.txt"'
    stored = [item.name for item in stores.documents.iterdir()]
    assert len(stored) == 1 and stored[0] != "my-notes.txt"
    assert (stores.documents / stored[0]).read_bytes() == content


def test_reference_files_are_restored_without_touching_what_is_there(tmp_path) -> None:
    reference = tmp_path / "reference_data"
    data = tmp_path / "data"
    (reference / "documents").mkdir(parents=True)
    (reference / "datasets").mkdir()
    paper = bytes(range(256)) * 40
    (reference / "documents" / "paper.pdf").write_bytes(paper)
    (reference / "documents" / "release.txt").write_text("the original release", encoding="utf-8")
    (reference / "datasets" / "table.csv").write_text("Year,Value\n2016,10.165\n", encoding="utf-8")
    (reference / "REAL_DATA_SOURCES.md").write_text("# Sources\n", encoding="utf-8")
    (reference / "documents" / ".DS_Store").write_bytes(b"ignored")

    # What is already on the server: an upload, a changed copy, an index.
    (data / "documents").mkdir(parents=True)
    (data / "documents" / "upload-0a1b2c.pdf").write_bytes(b"%PDF- a researcher upload")
    (data / "documents" / "release.txt").write_text("changed on the server", encoding="utf-8")
    (data / "semantic_search").mkdir()
    (data / "semantic_search" / "vectors.npz").write_bytes(b"index")

    copied = reference_data.restore_reference_files(reference, data)

    assert copied == ["REAL_DATA_SOURCES.md", "datasets/table.csv", "documents/paper.pdf"]
    # Byte for byte.
    assert (data / "documents" / "paper.pdf").read_bytes() == paper
    assert (data / "datasets" / "table.csv").read_text(encoding="utf-8") == "Year,Value\n2016,10.165\n"
    # Nothing that was there is replaced or removed.
    assert (data / "documents" / "release.txt").read_text(encoding="utf-8") == "changed on the server"
    assert (data / "documents" / "upload-0a1b2c.pdf").read_bytes() == b"%PDF- a researcher upload"
    assert (data / "semantic_search" / "vectors.npz").read_bytes() == b"index"
    assert sorted(item.name for item in (data / "documents").iterdir()) == [
        "paper.pdf",
        "release.txt",
        "upload-0a1b2c.pdf",
    ]

    # A second run has nothing to do, and a missing reference folder is fine.
    assert reference_data.restore_reference_files(reference, data) == []
    assert reference_data.restore_reference_files(tmp_path / "none", data) == []


def test_the_api_restores_reference_files_when_it_starts(tmp_path, monkeypatch) -> None:
    reference = tmp_path / "reference_data"
    (reference / "documents").mkdir(parents=True)
    (reference / "documents" / "paper.pdf").write_bytes(b"%PDF- reference paper")
    monkeypatch.setattr(reference_data, "REFERENCE_ROOT", reference)
    monkeypatch.setattr(reference_data, "DATA_ROOT", tmp_path / "data")

    # Starting the application is enough. No start command has to do it.
    with TestClient(app) as started:
        assert started.get("/health").status_code == 200

    assert (tmp_path / "data" / "documents" / "paper.pdf").read_bytes() == b"%PDF- reference paper"


def test_restore_never_stops_the_api_from_starting(tmp_path, monkeypatch, capsys) -> None:
    def refuse(*_args, **_kwargs):
        raise PermissionError("the volume is read-only")

    monkeypatch.setattr(reference_data, "restore_reference_files", refuse)

    with TestClient(app) as started:
        assert started.get("/health").status_code == 200

    assert "could not be restored" in capsys.readouterr().out
