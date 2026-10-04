from __future__ import annotations

import atexit
import secrets
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.data_lab import config
from app.data_lab.outputs import sanitize_reply
from app.data_lab.runtime import LabSessionEnded, LabUnavailable, start_container
from app.datasets.files import DatasetFile, find_dataset_file
from app.models import Dataset

UNSUPPORTED_MESSAGE = "This dataset cannot currently be opened in Polar Data Lab."


class DatasetNotSupported(Exception):
    """The dataset has no file that a session can open. The message is safe to show."""


class SessionNotFound(Exception):
    pass


class TooManySessions(Exception):
    pass


@dataclass
class LabSession:
    id: str
    # The account that started the session. Nobody else can use or end it.
    user_id: str
    dataset_id: str
    dataset_title: str
    file_type: str
    process: object
    created_at: datetime
    last_activity: float = field(default_factory=time.monotonic)
    lock: threading.Lock = field(default_factory=threading.Lock)

    @property
    def data_path(self) -> str:
        return f"{config.DATA_DIRECTORY}/dataset.{self.file_type}"


_sessions: dict[str, LabSession] = {}
_sessions_lock = threading.Lock()


def lab_file(dataset: Dataset) -> DatasetFile:
    """Return the dataset file a session may open, or explain why there is none."""
    if not dataset.file_name:
        raise DatasetNotSupported(f"{UNSUPPORTED_MESSAGE} It has no data file.")
    stored = find_dataset_file(dataset)
    if stored is None:
        raise DatasetNotSupported(f"{UNSUPPORTED_MESSAGE} Its data file could not be found.")
    if stored.file_type not in config.LAB_FILE_TYPES:
        raise DatasetNotSupported(
            f"{UNSUPPORTED_MESSAGE} Only CSV and JSON files are supported."
        )
    if stored.size_bytes > config.MAX_LAB_FILE_BYTES:
        raise DatasetNotSupported(f"{UNSUPPORTED_MESSAGE} Its data file is too large.")
    return stored


def starter_cells(file_type: str) -> list[dict[str, str]]:
    path = f"{config.DATA_DIRECTORY}/dataset.{file_type}"
    reader = "read_csv" if file_type == "csv" else "read_json"
    return [
        {
            "title": "Load the dataset and show the first rows",
            "code": f'import pandas as pd\n\ndf = pd.{reader}("{path}")\ndf.head()',
        },
        {"title": "Show the column names", "code": "df.columns.tolist()"},
        {"title": "Summarize numeric columns", "code": "df.describe()"},
        {
            "title": "Create a chart",
            "code": (
                "import matplotlib.pyplot as plt\n\n"
                'df.select_dtypes("number").plot()\n'
                "plt.show()"
            ),
        },
    ]


def _stop(session: LabSession) -> None:
    try:
        session.process.stop()
    except Exception:
        pass


def _sweep() -> None:
    """End sessions that have been idle too long or whose container has gone."""
    limit = config.idle_timeout_minutes() * 60
    now = time.monotonic()
    with _sessions_lock:
        expired = [
            session
            for session in _sessions.values()
            if not session.process.alive or now - session.last_activity > limit
        ]
        for session in expired:
            del _sessions[session.id]
    for session in expired:
        _stop(session)


def create_session(dataset: Dataset, user_id: str) -> LabSession:
    stored = lab_file(dataset)
    _sweep()
    with _sessions_lock:
        if len(_sessions) >= config.max_sessions():
            raise TooManySessions

    # The id comes from the backend only. It also names the container.
    session_id = secrets.token_hex(16)
    process = start_container(session_id, stored.path, stored.file_type)
    session = LabSession(
        id=session_id,
        user_id=user_id,
        dataset_id=dataset.id,
        dataset_title=dataset.title,
        file_type=stored.file_type,
        process=process,
        created_at=datetime.now(timezone.utc),
    )
    with _sessions_lock:
        _sessions[session_id] = session
    return session


def _get(session_id: str, user_id: str) -> LabSession:
    _sweep()
    with _sessions_lock:
        session = _sessions.get(session_id)
    if session is None or session.user_id != user_id:
        raise SessionNotFound
    return session


def execute_cell(session_id: str, code: str, user_id: str) -> dict:
    session = _get(session_id, user_id)
    with session.lock:
        session.last_activity = time.monotonic()
        started = time.monotonic()
        try:
            reply = session.process.execute(code, config.cell_timeout_seconds())
        except LabSessionEnded as error:
            end_session(session_id, user_id)
            raise SessionNotFound from error
        session.last_activity = time.monotonic()

    result = sanitize_reply(reply)
    result["duration_ms"] = int((time.monotonic() - started) * 1000)
    return result


def end_session(session_id: str, user_id: str) -> bool:
    with _sessions_lock:
        session = _sessions.get(session_id)
        if session is None or session.user_id != user_id:
            return False
        del _sessions[session_id]
    _stop(session)
    return True


def end_all_sessions() -> None:
    with _sessions_lock:
        sessions = list(_sessions.values())
        _sessions.clear()
    for session in sessions:
        _stop(session)


def session_count() -> int:
    with _sessions_lock:
        return len(_sessions)


atexit.register(end_all_sessions)

__all__ = [
    "DatasetNotSupported",
    "LabSession",
    "LabUnavailable",
    "SessionNotFound",
    "TooManySessions",
    "create_session",
    "end_all_sessions",
    "end_session",
    "execute_cell",
    "lab_file",
    "session_count",
    "starter_cells",
]
