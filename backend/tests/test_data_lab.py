import base64
import subprocess
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.data_lab import config, runtime, sessions
from app.data_lab.outputs import PNG_SIGNATURE, sanitize_reply
from app.data_lab.runtime import LabSessionEnded, LabUnavailable, build_run_command
from app.database import SessionLocal
from app.datasets import files
from app.datasets.files import DATASET_STORE, attach_dataset_file
from app.main import app
from app.models import Dataset
from app.seed import DEMO_DATASET_FILE_NAME, DEMO_IDS
from demo_data import seed_demo_data
from conftest import create_test_user, delete_test_users, log_in

client = TestClient(app)

PREVIEW_ID = DEMO_IDS["datasets"]["preview"]
METADATA_ONLY_ID = DEMO_IDS["datasets"]["temperature"]
SESSIONS_URL = "/api/data-lab/sessions"
OK_REPLY = {
    "status": "ok",
    "outputs": [{"type": "text", "stream": "result", "text": "20"}],
    "truncated": False,
    "execution_count": 2,
    "state_lost": False,
}


class FakeProcess:
    """Stands in for a session container so these tests never need Docker."""

    def __init__(self) -> None:
        self.alive = True
        self.calls: list[tuple[str, int]] = []
        self.reply: object = OK_REPLY
        self.ended = False

    def execute(self, code: str, timeout: int) -> object:
        self.calls.append((code, timeout))
        if self.ended:
            raise LabSessionEnded("gone")
        return self.reply

    def stop(self) -> None:
        self.alive = False


@pytest.fixture
def lab(monkeypatch):
    """Enable the Data Lab with a fake runtime. Returns the started containers."""
    with SessionLocal() as session:
        seed_demo_data(session)
    started: list[SimpleNamespace] = []

    def fake_start(session_id, dataset_path, file_type):
        process = FakeProcess()
        started.append(
            SimpleNamespace(
                session_id=session_id,
                dataset_path=dataset_path,
                file_type=file_type,
                process=process,
            )
        )
        return process

    monkeypatch.setenv("DATA_LAB_ENABLED", "true")
    monkeypatch.delenv("DATA_LAB_MAX_SESSIONS", raising=False)
    monkeypatch.delenv("DATA_LAB_CELL_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("DATA_LAB_IDLE_TIMEOUT_MINUTES", raising=False)
    monkeypatch.setattr(sessions, "start_container", fake_start)
    sessions.end_all_sessions()
    # The Data Lab is for research users, so these tests sign in as one.
    researcher = create_test_user("researcher")
    assert log_in(client, researcher).status_code == 200
    try:
        yield started
    finally:
        sessions.end_all_sessions()
        client.cookies.clear()
        delete_test_users([researcher.id])


@pytest.fixture
def temporary_dataset(tmp_path, monkeypatch):
    """A temporary dataset record in a temporary dataset store."""
    store = tmp_path / "datasets"
    store.mkdir()
    monkeypatch.setattr(files, "DATASET_STORE", store)
    with SessionLocal() as session:
        dataset = Dataset(title="Test dataset for data lab checks", is_demo_data=True)
        session.add(dataset)
        session.commit()
        dataset_id = dataset.id
    try:
        yield SimpleNamespace(id=dataset_id, store=store, tmp_path=tmp_path)
    finally:
        with SessionLocal() as session:
            record = session.get(Dataset, dataset_id)
            if record is not None:
                session.delete(record)
                session.commit()


def _create(dataset_id: str = PREVIEW_ID):
    return client.post(SESSIONS_URL, json={"dataset_id": dataset_id})


def _execute(session_id: str, code: str):
    return client.post(f"{SESSIONS_URL}/{session_id}/execute", json={"code": code})


def test_data_lab_is_off_unless_enabled(monkeypatch, client_as) -> None:
    monkeypatch.delenv("DATA_LAB_ENABLED", raising=False)
    monkeypatch.setattr(
        sessions,
        "start_container",
        lambda *args: pytest.fail("No container may start while the Data Lab is off"),
    )
    session_id = "0" * 32
    # Even a research user cannot run code while the switch is off.
    researcher = client_as("researcher")

    assert client.get("/api/data-lab/status").json()["enabled"] is False
    for response in (
        researcher.post(SESSIONS_URL, json={"dataset_id": PREVIEW_ID}),
        researcher.post(f"{SESSIONS_URL}/{session_id}/execute", json={"code": "1 + 1"}),
        researcher.delete(f"{SESSIONS_URL}/{session_id}"),
    ):
        assert response.status_code == 403
        assert response.json() == {"detail": "Polar Data Lab is not enabled."}


@pytest.mark.parametrize("value", ["false", "0", "no", "", "maybe"])
def test_only_clear_values_enable_the_data_lab(monkeypatch, client_as, value) -> None:
    monkeypatch.setenv("DATA_LAB_ENABLED", value)

    assert config.is_enabled() is False
    response = client_as("researcher").post(SESSIONS_URL, json={"dataset_id": PREVIEW_ID})
    assert response.status_code == 403


def test_session_is_created_for_a_supported_dataset(lab) -> None:
    status = client.get("/api/data-lab/status").json()
    response = _create()

    assert status == {
        "enabled": True,
        "supported_file_types": ["csv", "json"],
        "cell_timeout_seconds": 30,
        "idle_timeout_minutes": 30,
    }
    assert response.status_code == 201
    body = response.json()
    assert len(body["session_id"]) == 32
    assert int(body["session_id"], 16) >= 0
    assert body["dataset_id"] == PREVIEW_ID
    assert body["dataset_title"] == "Demo Prototype Preview Dataset"
    assert body["file_type"] == "csv"
    assert body["data_path"] == "/data/dataset.csv"
    assert body["cell_timeout_seconds"] == 30
    assert [cell["title"] for cell in body["starter_cells"]] == [
        "Load the dataset and show the first rows",
        "Show the column names",
        "Summarize numeric columns",
        "Create a chart",
    ]
    assert 'pd.read_csv("/data/dataset.csv")' in body["starter_cells"][0]["code"]

    # The container is given the stored file. The host path stays private.
    assert len(lab) == 1
    assert lab[0].session_id == body["session_id"]
    assert lab[0].dataset_path == (DATASET_STORE / DEMO_DATASET_FILE_NAME).resolve()
    assert lab[0].file_type == "csv"
    assert str(DATASET_STORE) not in response.text
    assert DEMO_DATASET_FILE_NAME not in response.text


def test_session_ids_come_from_the_backend(lab) -> None:
    first = _create().json()["session_id"]
    second = _create().json()["session_id"]

    assert first != second
    response = client.post(
        SESSIONS_URL, json={"dataset_id": PREVIEW_ID, "session_id": "chosen-by-browser"}
    )
    assert response.json()["session_id"] != "chosen-by-browser"


def test_unknown_dataset_does_not_start_a_session(lab) -> None:
    response = _create("00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    assert response.json() == {"detail": "Dataset not found"}
    assert lab == []


def test_metadata_only_dataset_cannot_be_opened(lab) -> None:
    response = _create(METADATA_ONLY_ID)

    assert response.status_code == 422
    assert response.json()["detail"].startswith(
        "This dataset cannot currently be opened in Polar Data Lab."
    )
    assert lab == []


def test_unsupported_and_missing_files_cannot_be_opened(lab, temporary_dataset) -> None:
    source = temporary_dataset.tmp_path / "notes.txt"
    source.write_text("Plain text is stored but not analysed.", encoding="utf-8")
    with SessionLocal() as session:
        attach_dataset_file(session, temporary_dataset.id, source)

    unsupported = _create(temporary_dataset.id)
    (temporary_dataset.store / f"{temporary_dataset.id}.txt").unlink()
    missing = _create(temporary_dataset.id)

    assert unsupported.status_code == 422
    assert "Only CSV and JSON files are supported." in unsupported.json()["detail"]
    assert missing.status_code == 422
    assert "could not be found" in missing.json()["detail"]
    assert lab == []


@pytest.mark.parametrize("file_name", ["../secret.csv", "nested/secret.csv", "..", ".hidden.csv"])
def test_file_names_outside_the_store_never_reach_a_container(
    lab, temporary_dataset, file_name
) -> None:
    (temporary_dataset.tmp_path / "secret.csv").write_text("secret\n1\n", encoding="utf-8")
    (temporary_dataset.store / "nested").mkdir()
    (temporary_dataset.store / "nested" / "secret.csv").write_text("s\n1\n", encoding="utf-8")
    (temporary_dataset.store / ".hidden.csv").write_text("s\n1\n", encoding="utf-8")
    with SessionLocal() as session:
        session.get(Dataset, temporary_dataset.id).file_name = file_name
        session.commit()

    response = _create(temporary_dataset.id)

    assert response.status_code == 422
    assert lab == []


def test_large_files_cannot_be_opened(lab, monkeypatch) -> None:
    monkeypatch.setattr(config, "MAX_LAB_FILE_BYTES", 10)

    response = _create()

    assert response.status_code == 422
    assert "too large" in response.json()["detail"]
    assert lab == []


def test_cells_run_in_the_same_session(lab) -> None:
    session_id = _create().json()["session_id"]

    first = _execute(session_id, "x = 10")
    second = _execute(session_id, "x * 2")

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == {
        "status": "ok",
        "outputs": [
            {
                "type": "text",
                "stream": "result",
                "text": "20",
                "columns": None,
                "index": None,
                "index_name": None,
                "rows": None,
                "total_rows": None,
                "total_columns": None,
                "media_type": None,
                "data": None,
                "name": None,
                "message": None,
                "traceback": None,
            }
        ],
        "truncated": False,
        "execution_count": 2,
        "state_lost": False,
        "duration_ms": second.json()["duration_ms"],
    }
    # Both cells went to one container, in order, with the cell timeout.
    assert len(lab) == 1
    assert lab[0].process.calls == [("x = 10", 30), ("x * 2", 30)]


def test_cell_timeout_can_be_set(lab, monkeypatch) -> None:
    monkeypatch.setenv("DATA_LAB_CELL_TIMEOUT_SECONDS", "5")
    session_id = _create().json()["session_id"]

    _execute(session_id, "1 + 1")

    assert lab[0].process.calls == [("1 + 1", 5)]


def test_table_output_is_returned_as_data(lab) -> None:
    session_id = _create().json()["session_id"]
    lab[0].process.reply = {
        "status": "ok",
        "outputs": [
            {
                "type": "table",
                "columns": ["sample_number", "data_label"],
                "index": ["0", "1"],
                "index_name": None,
                "rows": [[1, "Demo / Prototype Data"], [2, None]],
                "total_rows": 24,
                "total_columns": 5,
            }
        ],
        "truncated": False,
        "execution_count": 1,
        "state_lost": False,
    }

    table = _execute(session_id, "df.head(2)").json()["outputs"][0]

    assert table["type"] == "table"
    assert table["columns"] == ["sample_number", "data_label"]
    assert table["rows"] == [[1, "Demo / Prototype Data"], [2, None]]
    assert table["total_rows"] == 24
    assert table["total_columns"] == 5


def test_python_errors_and_timeouts_are_reported(lab) -> None:
    session_id = _create().json()["session_id"]

    lab[0].process.reply = {
        "status": "error",
        "outputs": [
            {
                "type": "error",
                "name": "NameError",
                "message": "name 'missing' is not defined",
                "traceback": "NameError: name 'missing' is not defined",
            }
        ],
    }
    error = _execute(session_id, "missing").json()

    lab[0].process.reply = {
        "status": "timeout",
        "outputs": [
            {
                "type": "error",
                "name": "Timeout",
                "message": "The cell ran longer than 30 seconds and was stopped.",
                "traceback": "",
            }
        ],
    }
    timeout = _execute(session_id, "while True: pass").json()

    assert error["status"] == "error"
    assert error["outputs"][0]["name"] == "NameError"
    assert error["outputs"][0]["message"] == "name 'missing' is not defined"
    assert timeout["status"] == "timeout"
    assert timeout["outputs"][0]["name"] == "Timeout"
    # The session is still usable after either.
    lab[0].process.reply = OK_REPLY
    assert _execute(session_id, "x * 2").status_code == 200


@pytest.mark.parametrize("code", ["", "   \n  "])
def test_empty_code_is_rejected(lab, code) -> None:
    session_id = _create().json()["session_id"]

    response = _execute(session_id, code)

    assert response.status_code == 422
    assert response.json() == {"detail": "Code cannot be empty"}
    assert lab[0].process.calls == []


def test_very_large_code_is_rejected(lab) -> None:
    session_id = _create().json()["session_id"]

    response = _execute(session_id, "x" * (config.MAX_CODE_CHARS + 1))

    assert response.status_code == 422
    assert lab[0].process.calls == []


def test_ending_a_session_stops_its_container(lab) -> None:
    session_id = _create().json()["session_id"]

    deleted = client.delete(f"{SESSIONS_URL}/{session_id}")

    assert deleted.status_code == 204
    assert lab[0].process.alive is False
    assert sessions.session_count() == 0
    assert _execute(session_id, "1 + 1").status_code == 404
    assert client.delete(f"{SESSIONS_URL}/{session_id}").status_code == 404


def test_reset_gives_a_new_session_with_a_new_container(lab) -> None:
    first = _create().json()["session_id"]
    client.delete(f"{SESSIONS_URL}/{first}")

    second = _create().json()["session_id"]

    assert second != first
    assert len(lab) == 2
    assert lab[0].process.alive is False
    assert lab[1].process.alive is True
    assert _execute(second, "1 + 1").status_code == 200
    assert lab[1].process.calls == [("1 + 1", 30)]


@pytest.mark.parametrize(
    "session_id",
    ["f" * 32, "abc", "A" * 32, "..%2F..%2Fetc%2Fpasswd", "0" * 31, "g" * 32, "0" * 64],
)
def test_unknown_or_malformed_session_ids_are_not_found(lab, session_id) -> None:
    _create()

    execute = _execute(session_id, "1 + 1")
    delete = client.delete(f"{SESSIONS_URL}/{session_id}")

    assert execute.status_code == 404
    assert delete.status_code == 404
    assert lab[0].process.calls == []
    assert lab[0].process.alive is True


def test_a_container_that_has_gone_ends_the_session(lab) -> None:
    session_id = _create().json()["session_id"]
    lab[0].process.ended = True

    response = _execute(session_id, "1 + 1")

    assert response.status_code == 404
    assert "has ended" in response.json()["detail"]
    assert sessions.session_count() == 0


def test_idle_sessions_are_ended(lab, monkeypatch) -> None:
    session_id = _create().json()["session_id"]
    session = sessions._sessions[session_id]
    session.last_activity = time.monotonic() - (config.idle_timeout_minutes() * 60 + 1)

    response = _execute(session_id, "1 + 1")

    assert response.status_code == 404
    assert lab[0].process.alive is False
    assert sessions.session_count() == 0


def test_number_of_sessions_is_limited(lab, monkeypatch) -> None:
    monkeypatch.setenv("DATA_LAB_MAX_SESSIONS", "1")

    first = _create()
    second = _create()

    assert first.status_code == 201
    assert second.status_code == 429
    assert len(lab) == 1


def test_runtime_problems_return_a_plain_message(lab, monkeypatch) -> None:
    def unavailable(*args):
        raise LabUnavailable("Docker is not running, so analysis sessions cannot start.")

    monkeypatch.setattr(sessions, "start_container", unavailable)

    response = _create()

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Docker is not running, so analysis sessions cannot start."
    }
    assert "Traceback" not in response.text
    assert sessions.session_count() == 0


def test_container_command_is_isolated() -> None:
    dataset = Path("/srv/dhruvsetu/datasets/example.csv")

    command = build_run_command("docker", "a" * 32, dataset, "csv")
    text = " ".join(command)

    assert command[:4] == ["docker", "run", "--rm", "--interactive"]
    assert command[command.index("--network") + 1] == "none"
    assert "--read-only" in command
    assert command[command.index("--cap-drop") + 1] == "ALL"
    assert command[command.index("--security-opt") + 1] == "no-new-privileges"
    assert command[command.index("--memory") + 1] == "512m"
    assert command[command.index("--memory-swap") + 1] == "512m"
    assert command[command.index("--cpus") + 1] == "1"
    assert command[command.index("--pids-limit") + 1] == "128"
    assert command[command.index("--name") + 1] == "dhruvsetu-lab-" + "a" * 32

    # Exactly one host path is mounted: the dataset file, read-only.
    assert command.count("--mount") == 1
    assert command[command.index("--mount") + 1] == (
        "type=bind,source=/srv/dhruvsetu/datasets/example.csv,"
        "target=/data/dataset.csv,readonly"
    )
    for forbidden in ("docker.sock", "--privileged", "--volume", " -v ", ".env", "--publish", " -p "):
        assert forbidden not in text
    assert "MYSQL" not in text and "API_KEY" not in text


def test_dataset_paths_that_could_add_mount_options_are_refused() -> None:
    with pytest.raises(LabUnavailable):
        build_run_command("docker", "a" * 32, Path("/data/a,readonly=false.csv"), "csv")


def test_missing_docker_or_image_is_explained(monkeypatch) -> None:
    dataset = Path("/srv/example.csv")

    monkeypatch.setattr(runtime.shutil, "which", lambda name: None)
    with pytest.raises(LabUnavailable, match="Docker is not installed"):
        runtime.start_container("a" * 32, dataset, "csv")

    monkeypatch.setattr(runtime.shutil, "which", lambda name: "/usr/bin/docker")
    results = iter(
        [
            subprocess.CompletedProcess([], 1, "", "Cannot connect to the Docker daemon"),
            subprocess.CompletedProcess([], 1, "", "Error: No such image"),
        ]
    )
    monkeypatch.setattr(runtime.subprocess, "run", lambda *args, **kwargs: next(results))
    monkeypatch.setattr(
        runtime, "LabProcess", lambda *args: pytest.fail("No container may be started")
    )
    with pytest.raises(LabUnavailable, match="Docker is not running"):
        runtime.start_container("a" * 32, dataset, "csv")
    with pytest.raises(LabUnavailable, match="docker compose build data-lab"):
        runtime.start_container("a" * 32, dataset, "csv")


def _png(size: int = 64) -> str:
    return base64.b64encode(PNG_SIGNATURE + b"\x00" * size).decode("ascii")


def test_output_text_is_limited() -> None:
    result = sanitize_reply(
        {
            "status": "ok",
            "outputs": [
                {"type": "text", "stream": "stdout", "text": "a" * 15_000},
                {"type": "text", "stream": "weird", "text": "b" * 15_000},
                {"type": "text", "stream": "stdout", "text": "never shown"},
            ],
        }
    )

    assert sum(len(item["text"]) for item in result["outputs"]) == 20_000
    assert result["outputs"][1]["stream"] == "stdout"
    assert len(result["outputs"]) == 2
    assert result["truncated"] is True


def test_output_tables_are_limited_and_cleaned() -> None:
    result = sanitize_reply(
        {
            "status": "ok",
            "outputs": [
                {
                    "type": "table",
                    "columns": [f"c{index}" for index in range(40)],
                    "index": [str(index) for index in range(60)],
                    "index_name": None,
                    "rows": [
                        [True, float("nan"), float("inf"), "x" * 500, 2**60, {"a": 1}]
                        + [index] * 34
                        for index in range(60)
                    ],
                    "total_rows": 1000,
                    "total_columns": 40,
                }
            ],
        }
    )

    table = result["outputs"][0]
    assert len(table["columns"]) == 30
    assert len(table["rows"]) == 50
    assert len(table["index"]) == 50
    assert all(len(row) == 30 for row in table["rows"])
    first = table["rows"][0]
    assert first[0] == "True"
    assert first[1] == "nan"
    assert first[2] == "inf"
    assert len(first[3]) == 200
    assert first[4] == str(2**60)
    assert first[5] == "{'a': 1}"
    assert table["total_rows"] == 1000


def test_only_real_png_images_are_passed_on() -> None:
    result = sanitize_reply(
        {
            "status": "ok",
            "outputs": [
                {"type": "image", "media_type": "image/png", "data": _png()},
                {"type": "image", "media_type": "image/svg+xml", "data": _png()},
                {"type": "image", "media_type": "image/png", "data": "not base64 !!"},
                {
                    "type": "image",
                    "media_type": "image/png",
                    "data": base64.b64encode(b"<script>alert(1)</script>").decode(),
                },
                {"type": "image", "media_type": "image/png", "data": _png(2 * 1024 * 1024)},
            ],
        }
    )

    assert [item["type"] for item in result["outputs"]] == ["image"]
    assert result["outputs"][0]["media_type"] == "image/png"
    assert result["truncated"] is True


def test_html_and_unknown_output_is_dropped() -> None:
    result = sanitize_reply(
        {
            "status": "something-else",
            "outputs": [
                {"type": "html", "html": "<script>alert(1)</script>"},
                {"type": "text", "stream": "stdout", "text": "kept"},
                "not an object",
                {"type": "error", "name": "ValueError", "message": "bad", "traceback": "t" * 9000},
            ],
            "execution_count": "7",
        }
    )

    assert result["status"] == "error"
    assert [item["type"] for item in result["outputs"]] == ["text", "error"]
    assert len(result["outputs"][1]["traceback"]) == 6000
    assert result["execution_count"] is None
    assert sanitize_reply("garbage") == {
        "status": "error",
        "outputs": [],
        "truncated": False,
        "execution_count": None,
        "state_lost": False,
    }


def test_too_many_outputs_are_cut() -> None:
    result = sanitize_reply(
        {"status": "ok", "outputs": [{"type": "error", "name": "E"}] * 45}
    )

    assert len(result["outputs"]) == 30
    assert result["truncated"] is True
