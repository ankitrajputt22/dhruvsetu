from __future__ import annotations

import base64
import binascii
import math

# The container runs user code, so everything it sends back is checked again
# here before it reaches the browser.
MAX_OUTPUTS = 30
MAX_TEXT_CHARS = 20_000
MAX_TABLE_ROWS = 50
MAX_TABLE_COLUMNS = 30
MAX_CELL_CHARS = 200
MAX_IMAGES = 4
MAX_IMAGE_BYTES = 1024 * 1024
MAX_TRACEBACK_CHARS = 6_000

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
STATUSES = {"ok", "error", "timeout", "kernel_died"}
STREAMS = {"stdout", "stderr", "result"}


def _clip(value: object, limit: int) -> str:
    text = value if isinstance(value, str) else str(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _cell(value: object) -> int | float | str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return value if abs(value) < 2**53 else str(value)
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    return _clip(value, MAX_CELL_CHARS)


def _count(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _table(item: dict) -> dict | None:
    columns, index, rows = item.get("columns"), item.get("index"), item.get("rows")
    if not (isinstance(columns, list) and isinstance(index, list) and isinstance(rows, list)):
        return None

    columns = [_clip(column, MAX_CELL_CHARS) for column in columns[:MAX_TABLE_COLUMNS]]
    rows = [
        [_cell(value) for value in row[: len(columns)]]
        for row in rows[:MAX_TABLE_ROWS]
        if isinstance(row, list)
    ]
    index = [_clip(label, MAX_CELL_CHARS) for label in index[: len(rows)]]
    index_name = item.get("index_name")
    return {
        "type": "table",
        "columns": columns,
        "index": index,
        "index_name": None if index_name is None else _clip(index_name, MAX_CELL_CHARS),
        "rows": rows,
        "total_rows": max(_count(item.get("total_rows")), len(rows)),
        "total_columns": max(_count(item.get("total_columns")), len(columns)),
    }


def _image(item: dict) -> dict | None:
    data = item.get("data")
    if item.get("media_type") != "image/png" or not isinstance(data, str):
        return None
    if len(data) > MAX_IMAGE_BYTES * 4 // 3 + 4:
        return None
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        return None
    if len(raw) > MAX_IMAGE_BYTES or not raw.startswith(PNG_SIGNATURE):
        return None
    return {
        "type": "image",
        "media_type": "image/png",
        "data": base64.b64encode(raw).decode("ascii"),
    }


def sanitize_reply(reply: object) -> dict:
    """Turn a raw container reply into a small, well-formed result."""
    if not isinstance(reply, dict):
        reply = {}
    status = reply.get("status")
    raw_outputs = reply.get("outputs")
    if not isinstance(raw_outputs, list):
        raw_outputs = []

    outputs: list[dict] = []
    truncated = bool(reply.get("truncated")) or len(raw_outputs) > MAX_OUTPUTS
    text_chars = 0
    images = 0

    for item in raw_outputs[:MAX_OUTPUTS]:
        if not isinstance(item, dict):
            continue
        kind = item.get("type")
        if kind == "text":
            room = MAX_TEXT_CHARS - text_chars
            text = item.get("text")
            if not isinstance(text, str) or room <= 0:
                truncated = truncated or room <= 0
                continue
            if len(text) > room:
                text, truncated = text[:room], True
            text_chars += len(text)
            stream = item.get("stream")
            outputs.append(
                {
                    "type": "text",
                    "stream": stream if stream in STREAMS else "stdout",
                    "text": text,
                }
            )
        elif kind == "table":
            table = _table(item)
            if table is not None:
                outputs.append(table)
        elif kind == "image":
            image = _image(item) if images < MAX_IMAGES else None
            if image is None:
                truncated = True
            else:
                images += 1
                outputs.append(image)
        elif kind == "error":
            outputs.append(
                {
                    "type": "error",
                    "name": _clip(item.get("name") or "Error", 200),
                    "message": _clip(item.get("message") or "", 2000),
                    "traceback": _clip(item.get("traceback") or "", MAX_TRACEBACK_CHARS),
                }
            )
        # Anything else, including HTML, is dropped.

    count = reply.get("execution_count")
    return {
        "status": status if status in STATUSES else "error",
        "outputs": outputs,
        "truncated": truncated,
        "execution_count": count if isinstance(count, int) and not isinstance(count, bool) else None,
        "state_lost": bool(reply.get("state_lost")),
    }
