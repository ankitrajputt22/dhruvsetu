from __future__ import annotations

import os

# File types that can be opened in a session, and where the file appears
# inside the container. The real host path is never shown to the user.
LAB_FILE_TYPES = ("csv", "json")
DATA_DIRECTORY = "/data"
MAX_LAB_FILE_BYTES = 50 * 1024 * 1024

MAX_CODE_CHARS = 20_000

# Limits applied to every session container.
CONTAINER_MEMORY = "512m"
CONTAINER_CPUS = "1"
CONTAINER_PROCESS_LIMIT = "128"
WORKSPACE_SIZE = "128m"
TEMP_SIZE = "64m"

STARTUP_TIMEOUT_SECONDS = 60
# Extra time the backend waits for a reply after the cell timeout.
REPLY_GRACE_SECONDS = 20


def _number(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, "").strip() or default)
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


def is_enabled() -> bool:
    return os.getenv("DATA_LAB_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


def image_name() -> str:
    return os.getenv("DATA_LAB_IMAGE", "").strip() or "dhruvsetu-data-lab:1"


def cell_timeout_seconds() -> int:
    return _number("DATA_LAB_CELL_TIMEOUT_SECONDS", 30, 1, 300)


def idle_timeout_minutes() -> int:
    return _number("DATA_LAB_IDLE_TIMEOUT_MINUTES", 30, 1, 240)


def max_sessions() -> int:
    return _number("DATA_LAB_MAX_SESSIONS", 3, 1, 10)
