import json

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.datasets import files, preview
from app.datasets.files import DatasetFileError, attach_dataset_file
from app.main import app
from app.models import Dataset
from app.seed import DEMO_DATASET_FILE_NAME, DEMO_IDS, seed_demo_data

client = TestClient(app)

TEMPERATURE_ID = DEMO_IDS["datasets"]["temperature"]
PREVIEW_ID = DEMO_IDS["datasets"]["preview"]
MISSING_ID = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def store(tmp_path, monkeypatch):
    """A temporary dataset store so tests never touch the real one."""
    path = tmp_path / "datasets"
    path.mkdir()
    monkeypatch.setattr(files, "DATASET_STORE", path)
    return path


@pytest.fixture
def dataset_id():
    """A temporary reviewed dataset record with no file."""
    with SessionLocal() as session:
        seed_demo_data(session)
        dataset = Dataset(
            title="Test dataset for explorer checks",
            description="Temporary test record.",
            verification_status="reviewed",
            is_demo_data=True,
        )
        session.add(dataset)
        session.commit()
        record_id = dataset.id
    try:
        yield record_id
    finally:
        with SessionLocal() as session:
            record = session.get(Dataset, record_id)
            if record is not None:
                session.delete(record)
                session.commit()


def _attach(dataset_id: str, tmp_path, name: str, content: str | bytes) -> None:
    source = tmp_path / name
    if isinstance(content, bytes):
        source.write_bytes(content)
    else:
        source.write_text(content, encoding="utf-8")
    with SessionLocal() as session:
        attach_dataset_file(session, dataset_id, source)


def _set_file_name(dataset_id: str, file_name: str) -> None:
    with SessionLocal() as session:
        session.get(Dataset, dataset_id).file_name = file_name
        session.commit()


def _ids(response) -> set[str]:
    assert response.status_code == 200
    return {item["id"] for item in response.json()}


def test_dataset_list_shows_related_records() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)

    response = client.get("/api/datasets")

    assert response.status_code == 200
    dataset = next(item for item in response.json() if item["id"] == TEMPERATURE_ID)
    climate_expedition = DEMO_IDS["expeditions"]["climate"]
    assert dataset["related_resources"] == [
        {
            "id": climate_expedition,
            "type": "expedition",
            "title": "Demo Antarctic Climate Expedition",
            "href": f"/expeditions/{climate_expedition}",
        }
    ]
    assert [topic["name"] for topic in dataset["research_topics"]] == [
        "Demo Antarctic Climate"
    ]
    assert dataset["file_type"] is None
    assert dataset["has_file"] is False
    assert dataset["verification_status"] == "uploaded"
    assert dataset["is_demo_data"] is True
    assert dataset["created_at"]


def test_dataset_filters_use_the_database(dataset_id, store, tmp_path) -> None:
    demo = DEMO_IDS["datasets"]
    demo_ids = set(demo.values())
    _attach(dataset_id, tmp_path, "values.csv", "a,b\n1,2\n")

    by_topic = _ids(
        client.get(
            "/api/datasets",
            params={"topic": DEMO_IDS["research_topics"]["sea-ice"]},
        )
    )
    by_expedition = _ids(
        client.get(
            "/api/datasets",
            params={"expedition": DEMO_IDS["expeditions"]["biology"]},
        )
    )
    by_text = _ids(client.get("/api/datasets", params={"q": "SEA ICE"}))
    by_type = _ids(client.get("/api/datasets", params={"file_type": "CSV"}))
    by_status = _ids(
        client.get("/api/datasets", params={"verification_status": "reviewed"})
    )
    combined = _ids(
        client.get(
            "/api/datasets",
            params={
                "topic": DEMO_IDS["research_topics"]["sea-ice"],
                "expedition": DEMO_IDS["expeditions"]["biology"],
            },
        )
    )

    assert by_topic & demo_ids == {demo["sea-ice"]}
    assert by_expedition & demo_ids == {demo["biodiversity"]}
    assert by_text & demo_ids == {demo["sea-ice"]}
    assert by_type & demo_ids == {demo["preview"]}
    assert dataset_id in by_type
    assert dataset_id in by_status
    assert not by_status & demo_ids
    assert combined == set()


def test_unknown_verification_status_filter_is_rejected() -> None:
    response = client.get("/api/datasets", params={"verification_status": "approved"})

    assert response.status_code == 422


def test_filter_values_only_list_what_datasets_use(dataset_id) -> None:
    response = client.get("/api/datasets/filters")

    assert response.status_code == 200
    filters = response.json()
    assert "csv" in filters["file_types"]
    assert filters["verification_statuses"] == ["uploaded", "reviewed"]
    assert {
        "Demo Antarctic Climate",
        "Demo Sea Ice",
        "Demo Polar Atmosphere",
        "Demo Polar Biodiversity",
    } <= {item["name"] for item in filters["research_topics"]}
    assert set(DEMO_IDS["expeditions"].values()) <= {
        item["id"] for item in filters["expeditions"]
    }


def test_metadata_only_dataset_has_no_file_or_preview() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)

    detail = client.get(f"/api/datasets/{TEMPERATURE_ID}")
    preview_response = client.get(f"/api/datasets/{TEMPERATURE_ID}/preview")
    download = client.get(f"/api/datasets/{TEMPERATURE_ID}/download")

    assert detail.status_code == 200
    dataset = detail.json()
    assert dataset["title"] == "Demo Antarctic Temperature Dataset"
    assert dataset["file"] is None
    assert dataset["has_file"] is False
    assert dataset["source_url"] is None
    assert dataset["related_resources"]
    assert dataset["research_topics"]
    assert "file_name" not in dataset
    assert preview_response.status_code == 404
    assert preview_response.json() == {"detail": "This dataset has no attached file."}
    assert download.status_code == 404


def test_missing_dataset_returns_404() -> None:
    for path in ("", "/preview", "/download"):
        response = client.get(f"/api/datasets/{MISSING_ID}{path}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Dataset not found"}


def test_csv_preview_returns_columns_rows_and_statistics(
    dataset_id, store, tmp_path
) -> None:
    _attach(
        dataset_id,
        tmp_path,
        "values.csv",
        "step,reading,group,notes\n1,2.5,A,\n2,3.5,B,\n3,,A,\n4,6,B,\n",
    )

    detail = client.get(f"/api/datasets/{dataset_id}").json()
    response = client.get(f"/api/datasets/{dataset_id}/preview")

    assert detail["has_file"] is True
    assert detail["file_type"] == "csv"
    assert detail["file"] == {
        "file_name": f"{dataset_id}.csv",
        "file_type": "csv",
        "size_bytes": (store / f"{dataset_id}.csv").stat().st_size,
        "available": True,
        "previewable": True,
        "preview_message": None,
    }
    assert response.status_code == 200
    body = response.json()
    assert body["file_type"] == "csv"
    assert body["row_count"] == 4
    assert body["column_count"] == 4
    assert body["preview_limit"] == preview.PREVIEW_ROW_LIMIT
    assert body["statistics_row_count"] == 4
    assert [(column["name"], column["type"]) for column in body["columns"]] == [
        ("step", "number"),
        ("reading", "number"),
        ("group", "text"),
        ("notes", "empty"),
    ]
    assert body["columns"][0]["statistics"] == {
        "count": 4,
        "minimum": 1,
        "maximum": 4,
        "mean": 2.5,
    }
    assert body["columns"][1]["statistics"] == {
        "count": 3,
        "minimum": 2.5,
        "maximum": 6,
        "mean": 4.0,
    }
    assert body["columns"][2]["statistics"] is None
    assert body["rows"] == [
        [1, 2.5, "A", None],
        [2, 3.5, "B", None],
        [3, None, "A", None],
        [4, 6, "B", None],
    ]


def test_json_preview_reads_a_list_of_records(dataset_id, store, tmp_path) -> None:
    records = [
        {"step": 1, "reading": 2.5, "flag": True},
        {"step": 2, "reading": None, "extra": {"nested": "value"}},
    ]
    _attach(dataset_id, tmp_path, "values.json", json.dumps(records))

    response = client.get(f"/api/datasets/{dataset_id}/preview")

    assert response.status_code == 200
    body = response.json()
    assert body["file_type"] == "json"
    assert body["row_count"] == 2
    assert [(column["name"], column["type"]) for column in body["columns"]] == [
        ("step", "number"),
        ("reading", "number"),
        ("flag", "text"),
        ("extra", "text"),
    ]
    assert body["rows"] == [
        [1, 2.5, "true", None],
        [2, None, None, '{"nested": "value"}'],
    ]


def test_preview_limits_rows_and_columns(dataset_id, store, tmp_path) -> None:
    header = ",".join(f"c{index}" for index in range(40))
    lines = [",".join(str(row + index) for index in range(40)) for row in range(120)]
    _attach(dataset_id, tmp_path, "wide.csv", "\n".join([header, *lines]) + "\n")

    body = client.get(f"/api/datasets/{dataset_id}/preview").json()

    assert body["row_count"] == 120
    assert len(body["rows"]) == preview.PREVIEW_ROW_LIMIT == 50
    assert body["column_count"] == 40
    assert len(body["columns"]) == preview.PREVIEW_COLUMN_LIMIT == 30
    assert all(len(row) == 30 for row in body["rows"])
    # Statistics use every scanned row, not only the rows shown.
    assert body["statistics_row_count"] == 120
    assert body["columns"][0]["statistics"]["count"] == 120
    assert body["columns"][0]["statistics"]["maximum"] == 119


def test_statistics_stop_at_the_row_limit(
    dataset_id, store, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(preview, "STATISTICS_ROW_LIMIT", 10)
    lines = "\n".join(str(value) for value in range(1, 101))
    _attach(dataset_id, tmp_path, "long.csv", f"value\n{lines}\n")

    body = client.get(f"/api/datasets/{dataset_id}/preview").json()

    assert body["row_count"] == 100
    assert body["statistics_row_count"] == 10
    assert body["columns"][0]["statistics"] == {
        "count": 10,
        "minimum": 1,
        "maximum": 10,
        "mean": 5.5,
    }


def test_unsupported_preview_format_is_handled(dataset_id, store, tmp_path) -> None:
    _attach(dataset_id, tmp_path, "notes.txt", "Plain text is stored but not previewed.")

    detail = client.get(f"/api/datasets/{dataset_id}").json()
    response = client.get(f"/api/datasets/{dataset_id}/preview")
    download = client.get(f"/api/datasets/{dataset_id}/download")

    assert detail["file"]["available"] is True
    assert detail["file"]["previewable"] is False
    assert detail["file"]["preview_message"] == (
        "Preview is not available for this file type."
    )
    assert response.status_code == 415
    assert response.json() == {
        "detail": "Preview is not available for this file type."
    }
    assert download.status_code == 200


@pytest.mark.parametrize("name", ["script.py", "program.exe", "page.html", "data"])
def test_attach_rejects_file_types_outside_the_allowed_list(
    dataset_id, store, tmp_path, name
) -> None:
    source = tmp_path / name
    source.write_text("content", encoding="utf-8")

    with SessionLocal() as session:
        with pytest.raises(DatasetFileError, match="Only these file types"):
            attach_dataset_file(session, dataset_id, source)

    assert list(store.iterdir()) == []
    assert client.get(f"/api/datasets/{dataset_id}").json()["file"] is None


def test_missing_file_is_handled(dataset_id, store, tmp_path) -> None:
    _attach(dataset_id, tmp_path, "values.csv", "a,b\n1,2\n")
    (store / f"{dataset_id}.csv").unlink()

    detail = client.get(f"/api/datasets/{dataset_id}").json()
    response = client.get(f"/api/datasets/{dataset_id}/preview")
    download = client.get(f"/api/datasets/{dataset_id}/download")

    assert detail["has_file"] is False
    assert detail["file"]["available"] is False
    assert detail["file"]["previewable"] is False
    assert detail["file"]["size_bytes"] is None
    assert response.status_code == 404
    assert response.json() == {
        "detail": "The file for this dataset could not be found."
    }
    assert download.status_code == 404


def test_large_file_is_not_previewed(dataset_id, store, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(preview, "MAX_PREVIEW_FILE_BYTES", 10)
    _attach(dataset_id, tmp_path, "values.csv", "a,b\n1,2\n3,4\n5,6\n")

    detail = client.get(f"/api/datasets/{dataset_id}").json()
    response = client.get(f"/api/datasets/{dataset_id}/preview")

    assert detail["file"]["available"] is True
    assert detail["file"]["previewable"] is False
    assert response.status_code == 413
    assert response.json() == {
        "detail": "Preview is not available for this file size."
    }


@pytest.mark.parametrize(
    "file_name",
    ["../secret.csv", "..", "nested/secret.csv", ".hidden.csv", "..\\secret.csv"],
)
def test_file_names_outside_the_store_are_never_read(
    dataset_id, store, tmp_path, file_name
) -> None:
    # Real files exist at every one of these places, so only the checks stop them.
    (tmp_path / "secret.csv").write_text("secret\nvalue\n", encoding="utf-8")
    (store / "nested").mkdir()
    (store / "nested" / "secret.csv").write_text("secret\nvalue\n", encoding="utf-8")
    (store / ".hidden.csv").write_text("secret\nvalue\n", encoding="utf-8")
    _set_file_name(dataset_id, file_name)

    detail = client.get(f"/api/datasets/{dataset_id}").json()
    response = client.get(f"/api/datasets/{dataset_id}/preview")
    download = client.get(f"/api/datasets/{dataset_id}/download")

    assert detail["has_file"] is False
    assert detail["file"]["available"] is False
    assert response.status_code == 404
    assert download.status_code == 404
    assert "secret" not in response.text
    assert "value" not in download.text


def test_absolute_paths_and_links_out_of_the_store_are_never_read(
    dataset_id, store, tmp_path
) -> None:
    outside = tmp_path / "outside.csv"
    outside.write_text("secret\nvalue\n", encoding="utf-8")

    _set_file_name(dataset_id, str(outside))
    assert client.get(f"/api/datasets/{dataset_id}/preview").status_code == 404
    assert client.get(f"/api/datasets/{dataset_id}/download").status_code == 404

    (store / "link.csv").symlink_to(outside)
    _set_file_name(dataset_id, "link.csv")
    assert client.get(f"/api/datasets/{dataset_id}/preview").status_code == 404
    assert client.get(f"/api/datasets/{dataset_id}/download").status_code == 404


@pytest.mark.parametrize(
    ("name", "content"),
    [
        ("binary.csv", b"\x00\x01\x02\xff\xfe"),
        ("not-utf8.csv", "température,valeur\n1,2\n".encode("latin-1")),
        ("empty.csv", b""),
        ("header-only.csv", b"a,b,c\n"),
        ("broken.json", b'{"step": 1,'),
        ("object.json", b'{"step": 1}'),
        ("values.json", b"[1, 2, 3]"),
        ("empty-list.json", b"[]"),
    ],
)
def test_malformed_files_return_a_clear_error(
    dataset_id, store, tmp_path, name, content
) -> None:
    _attach(dataset_id, tmp_path, name, content)

    response = client.get(f"/api/datasets/{dataset_id}/preview")

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, str) and detail
    assert "Traceback" not in detail
    assert str(store) not in detail


def test_download_is_sent_as_an_attachment(dataset_id, store, tmp_path) -> None:
    _attach(dataset_id, tmp_path, "values.csv", "a,b\n1,2\n")

    response = client.get(f"/api/datasets/{dataset_id}/download")

    assert response.status_code == 200
    assert response.text == "a,b\n1,2\n"
    assert response.headers["content-type"] == "application/octet-stream"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "attachment" in response.headers["content-disposition"]
    assert f"{dataset_id}.csv" in response.headers["content-disposition"]


def test_demo_fixture_file_is_labeled_as_prototype_data() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)

    detail = client.get(f"/api/datasets/{PREVIEW_ID}").json()
    response = client.get(f"/api/datasets/{PREVIEW_ID}/preview")

    assert detail["title"] == "Demo Prototype Preview Dataset"
    assert detail["description"].startswith("Demo / Prototype Data.")
    assert detail["is_demo_data"] is True
    assert detail["file"]["file_name"] == DEMO_DATASET_FILE_NAME
    assert detail["file"]["previewable"] is True
    assert response.status_code == 200
    body = response.json()
    assert body["row_count"] == 24
    names = [column["name"] for column in body["columns"]]
    assert names == [
        "sample_number",
        "demo_value_a",
        "demo_value_b",
        "demo_group",
        "data_label",
    ]
    label_index = names.index("data_label")
    assert {row[label_index] for row in body["rows"]} == {"Demo / Prototype Data"}


def test_search_links_datasets_to_their_detail_page() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)

    response = client.get("/api/search", params={"q": "ice", "type": "dataset"})

    assert response.status_code == 200
    results = response.json()
    assert results
    assert all(item["href"] == f"/datasets/{item['id']}" for item in results)
