"""Real Polar Data Lab sessions in Docker.

These tests start real containers. They are skipped when Docker is not running
or the Data Lab image has not been built (docker compose build data-lab).
"""
import base64
import hashlib
import os
import shutil
import subprocess

import pytest
from fastapi.testclient import TestClient

from app.data_lab import config, sessions
from app.data_lab.outputs import PNG_SIGNATURE
from app.database import SessionLocal
from app.datasets.files import DATASET_STORE
from app.main import app
from app.seed import DEMO_DATASET_FILE_NAME, DEMO_IDS
from demo_data import seed_demo_data
from conftest import create_test_user, delete_test_users, log_in

client = TestClient(app)

PREVIEW_ID = DEMO_IDS["datasets"]["preview"]
SESSIONS_URL = "/api/data-lab/sessions"
DATASET_FILE = DATASET_STORE / DEMO_DATASET_FILE_NAME


def _image_available() -> bool:
    docker = shutil.which("docker")
    if docker is None:
        return False
    try:
        result = subprocess.run(
            [docker, "image", "inspect", config.image_name()],
            capture_output=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0


pytestmark = pytest.mark.skipif(
    not _image_available(),
    reason="Docker is not running or the Data Lab image has not been built",
)


def _containers(session_id: str) -> str:
    return subprocess.run(
        ["docker", "ps", "--all", "--quiet", "--filter", f"name=dhruvsetu-lab-{session_id}"],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    ).stdout.strip()


def _file_hash() -> str:
    return hashlib.sha256(DATASET_FILE.read_bytes()).hexdigest()


@pytest.fixture(scope="module")
def enabled():
    with SessionLocal() as session:
        seed_demo_data(session)
    previous = {
        name: os.environ.get(name)
        for name in ("DATA_LAB_ENABLED", "DATA_LAB_CELL_TIMEOUT_SECONDS")
    }
    os.environ["DATA_LAB_ENABLED"] = "true"
    os.environ["DATA_LAB_CELL_TIMEOUT_SECONDS"] = "3"
    sessions.end_all_sessions()
    # Real sessions need a signed-in research user.
    researcher = create_test_user("researcher")
    assert log_in(client, researcher).status_code == 200
    try:
        yield
    finally:
        sessions.end_all_sessions()
        client.cookies.clear()
        delete_test_users([researcher.id])
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value


@pytest.fixture(scope="module")
def session_id(enabled):
    response = client.post(SESSIONS_URL, json={"dataset_id": PREVIEW_ID})
    assert response.status_code == 201, response.text
    yield response.json()["session_id"]


def _run(session_id: str, code: str) -> dict:
    response = client.post(f"{SESSIONS_URL}/{session_id}/execute", json={"code": code})
    assert response.status_code == 200, response.text
    return response.json()


def test_dataset_loads_and_head_returns_a_table(session_id) -> None:
    result = _run(
        session_id,
        'import pandas as pd\n\ndf = pd.read_csv("/data/dataset.csv")\ndf.head()',
    )

    assert result["status"] == "ok"
    table = result["outputs"][0]
    assert table["type"] == "table"
    assert table["columns"] == [
        "sample_number",
        "demo_value_a",
        "demo_value_b",
        "demo_group",
        "data_label",
    ]
    assert len(table["rows"]) == 5
    assert table["rows"][0] == [1, 13, 3.0, "Group A", "Demo / Prototype Data"]
    assert table["total_rows"] == 5


def test_describe_returns_a_summary_table(session_id) -> None:
    result = _run(session_id, "df.describe()")

    table = result["outputs"][0]
    assert table["type"] == "table"
    assert table["index"][:2] == ["count", "mean"]
    assert table["columns"] == ["sample_number", "demo_value_a", "demo_value_b"]
    assert table["rows"][0] == [24.0, 24.0, 24.0]


def test_long_tables_are_cut_to_the_row_limit(session_id) -> None:
    result = _run(session_id, "pd.DataFrame({'n': range(500)})")

    table = result["outputs"][0]
    assert len(table["rows"]) == 50
    assert table["total_rows"] == 500


def test_variables_persist_between_cells(session_id) -> None:
    first = _run(session_id, "x = 10")
    second = _run(session_id, "x * 2")

    assert first["outputs"] == []
    assert second["outputs"][0]["type"] == "text"
    assert second["outputs"][0]["stream"] == "result"
    assert second["outputs"][0]["text"] == "20"
    assert second["execution_count"] == first["execution_count"] + 1


def test_printed_text_and_warnings_are_returned(session_id) -> None:
    result = _run(
        session_id,
        'import sys\nprint("to stdout")\nprint("to stderr", file=sys.stderr)',
    )

    streams = {item["stream"]: item["text"] for item in result["outputs"]}
    assert streams == {"stdout": "to stdout\n", "stderr": "to stderr\n"}


def test_python_errors_are_shown_for_the_cell(session_id) -> None:
    name_error = _run(session_id, "undefined_name")
    syntax_error = _run(session_id, "def broken(:")

    assert name_error["status"] == "error"
    error = name_error["outputs"][0]
    assert error["type"] == "error"
    assert error["name"] == "NameError"
    assert "undefined_name" in error["message"]
    assert "NameError" in error["traceback"]
    assert "\x1b" not in error["traceback"]
    assert syntax_error["outputs"][0]["name"] == "SyntaxError"
    # The session keeps working after an error.
    assert _run(session_id, "x * 2")["outputs"][0]["text"] == "20"


def test_matplotlib_chart_is_returned_as_a_png(session_id) -> None:
    result = _run(
        session_id,
        'import matplotlib.pyplot as plt\n\ndf.select_dtypes("number").plot()\nplt.show()',
    )

    assert result["status"] == "ok"
    images = [item for item in result["outputs"] if item["type"] == "image"]
    assert len(images) == 1
    assert images[0]["media_type"] == "image/png"
    assert base64.b64decode(images[0]["data"]).startswith(PNG_SIGNATURE)


def test_html_is_never_returned(session_id) -> None:
    result = _run(
        session_id,
        "from IPython.display import HTML\nHTML('<script>alert(1)</script><b>bold</b>')",
    )

    assert [item["type"] for item in result["outputs"]] == ["text"]
    assert "<script>" not in result["outputs"][0]["text"]


def test_large_output_is_cut_and_reported(session_id) -> None:
    result = _run(session_id, "for number in range(20000):\n    print('line', number)")

    assert result["truncated"] is True
    assert sum(len(item["text"]) for item in result["outputs"]) <= 20_000


def test_session_has_no_network(session_id) -> None:
    result = _run(
        session_id,
        "import urllib.request\nurllib.request.urlopen('http://example.com', timeout=3)",
    )

    assert result["status"] == "error"
    assert result["outputs"][0]["name"] in {"URLError", "OSError", "gaierror"}


def test_session_cannot_see_the_host(session_id) -> None:
    result = _run(
        session_id,
        "import os\n"
        "print(sorted(os.listdir('/data')))\n"
        "print(os.getuid())\n"
        "print(os.path.exists('/Users'), os.path.exists('/var/run/docker.sock'))\n"
        "secret_words = ('MYSQL', 'PASSWORD', 'OPENAI', 'OPENROUTER', 'ANTHROPIC', 'API_KEY')\n"
        "print(sorted(name for name in os.environ if any(word in name for word in secret_words)))",
    )

    assert result["outputs"][0]["text"].splitlines() == [
        "['dataset.csv']",
        "1000",
        "False False",
        "[]",
    ]


def test_source_dataset_is_read_only_and_unchanged(session_id) -> None:
    before = _file_hash()

    write = _run(session_id, 'open("/data/dataset.csv", "a").write("changed")')
    remove = _run(session_id, 'import os\nos.remove("/data/dataset.csv")')
    system = _run(session_id, 'open("/etc/passwd", "a").write("x")')
    workspace = _run(
        session_id,
        'df.to_csv("/workspace/copy.csv", index=False)\nos.listdir("/workspace")',
    )

    for result in (write, remove, system):
        assert result["status"] == "error"
        assert result["outputs"][0]["name"] in {"OSError", "PermissionError"}
    # A working copy in the session workspace is allowed.
    assert workspace["status"] == "ok"
    assert workspace["outputs"][0]["text"] == "['copy.csv']"
    assert _file_hash() == before


def test_runaway_cell_is_stopped_and_state_is_kept(session_id) -> None:
    result = _run(session_id, "while True:\n    pass")

    assert result["status"] == "timeout"
    assert result["outputs"][-1]["name"] == "Timeout"
    assert "3 seconds" in result["outputs"][-1]["message"]
    assert result["duration_ms"] < 15_000
    assert _run(session_id, "x * 2")["outputs"][0]["text"] == "20"


def test_ending_and_resetting_a_session(session_id) -> None:
    before = _file_hash()
    assert _containers(session_id) != ""

    deleted = client.delete(f"{SESSIONS_URL}/{session_id}")
    gone = client.post(f"{SESSIONS_URL}/{session_id}/execute", json={"code": "x"})

    assert deleted.status_code == 204
    assert gone.status_code == 404
    assert _containers(session_id) == ""

    # A reset is a new session: the old variables are gone.
    created = client.post(SESSIONS_URL, json={"dataset_id": PREVIEW_ID})
    assert created.status_code == 201
    new_id = created.json()["session_id"]
    try:
        assert new_id != session_id
        fresh = _run(new_id, "x")
        assert fresh["status"] == "error"
        assert fresh["outputs"][0]["name"] == "NameError"
    finally:
        assert client.delete(f"{SESSIONS_URL}/{new_id}").status_code == 204
    assert _containers(new_id) == ""
    assert _file_hash() == before
