from __future__ import annotations

import csv
import io
import json
import math
import re
from dataclasses import dataclass, field

from app.datasets.files import PREVIEW_FILE_TYPES, DatasetFile

# Limits that keep previews small and fast. Change them here.
MAX_PREVIEW_FILE_BYTES = 5 * 1024 * 1024
PREVIEW_ROW_LIMIT = 50
PREVIEW_COLUMN_LIMIT = 30
STATISTICS_ROW_LIMIT = 5000
MAX_CELL_LENGTH = 200

NUMBER_PATTERN = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$")

Cell = int | float | str | None


class PreviewError(Exception):
    pass


class PreviewUnsupported(PreviewError):
    pass


class PreviewTooLarge(PreviewError):
    pass


class PreviewMalformed(PreviewError):
    pass


@dataclass(frozen=True)
class ColumnStatistics:
    count: int
    minimum: float
    maximum: float
    mean: float


@dataclass(frozen=True)
class PreviewColumn:
    name: str
    # Detected from the file contents: "number", "text" or "empty".
    type: str
    statistics: ColumnStatistics | None


@dataclass(frozen=True)
class DatasetPreview:
    file_type: str
    columns: list[PreviewColumn]
    rows: list[list[Cell]]
    row_count: int
    column_count: int
    preview_limit: int
    statistics_row_count: int


@dataclass
class _Table:
    column_names: list[str]
    rows: list[list[Cell]] = field(default_factory=list)
    row_count: int = 0


def preview_unavailable_reason(file: DatasetFile) -> str | None:
    """Return why a file cannot be previewed, or None when it can."""
    if file.file_type not in PREVIEW_FILE_TYPES:
        return "Preview is not available for this file type."
    if file.size_bytes > MAX_PREVIEW_FILE_BYTES:
        return "Preview is not available for this file size."
    return None


def build_preview(file: DatasetFile) -> DatasetPreview:
    if file.file_type not in PREVIEW_FILE_TYPES:
        raise PreviewUnsupported("Preview is not available for this file type.")
    if file.size_bytes > MAX_PREVIEW_FILE_BYTES:
        raise PreviewTooLarge("Preview is not available for this file size.")

    text = _read_text(file)
    table = _read_csv(text) if file.file_type == "csv" else _read_json(text)

    column_count = len(table.column_names)
    shown = min(column_count, PREVIEW_COLUMN_LIMIT)
    columns = [
        _describe_column(name, [row[index] for row in table.rows])
        for index, name in enumerate(table.column_names[:shown])
    ]
    rows = [
        [_number(cell) if columns[index].type == "number" else cell
         for index, cell in enumerate(row[:shown])]
        for row in table.rows[:PREVIEW_ROW_LIMIT]
    ]
    return DatasetPreview(
        file_type=file.file_type,
        columns=columns,
        rows=rows,
        row_count=table.row_count,
        column_count=column_count,
        preview_limit=PREVIEW_ROW_LIMIT,
        statistics_row_count=len(table.rows),
    )


def _read_text(file: DatasetFile) -> str:
    try:
        content = file.path.read_bytes()
    except OSError as error:
        raise PreviewMalformed("The file could not be read.") from error
    if b"\x00" in content:
        raise PreviewMalformed("The file is not a readable text file.")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise PreviewMalformed("The file must use UTF-8 text.") from error


def _column_names(raw_names: list[str]) -> list[str]:
    names: list[str] = []
    for index, raw in enumerate(raw_names, start=1):
        name = _clip(str(raw).strip()) or f"column_{index}"
        candidate, suffix = name, 2
        while candidate in names:
            candidate = f"{name}_{suffix}"
            suffix += 1
        names.append(candidate)
    return names


def _read_csv(text: str) -> _Table:
    try:
        reader = csv.reader(io.StringIO(text, newline=""))
        header = next(reader, None)
        if not header or not any(cell.strip() for cell in header):
            raise PreviewMalformed("The CSV file has no column names.")

        table = _Table(column_names=_column_names(header))
        width = len(table.column_names)
        for raw_row in reader:
            if not any(cell.strip() for cell in raw_row):
                continue
            table.row_count += 1
            if len(table.rows) < STATISTICS_ROW_LIMIT:
                cells = [cell.strip() for cell in raw_row[:width]]
                cells += [""] * (width - len(cells))
                table.rows.append([_clip(cell) if cell else None for cell in cells])
    except csv.Error as error:
        raise PreviewMalformed("The file could not be read as a CSV table.") from error

    if table.row_count == 0:
        raise PreviewMalformed("The CSV file has no data rows.")
    return table


def _read_json(text: str) -> _Table:
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, RecursionError) as error:
        raise PreviewMalformed("The file is not valid JSON.") from error

    if not isinstance(data, list) or not data:
        raise PreviewMalformed("The JSON file must contain a list of records.")
    if not all(isinstance(item, dict) for item in data):
        raise PreviewMalformed("Every JSON record must be an object.")

    scanned = data[:STATISTICS_ROW_LIMIT]
    keys: list[str] = []
    for record in scanned:
        for key in record:
            if key not in keys:
                keys.append(key)
    if not keys:
        raise PreviewMalformed("The JSON records have no fields.")

    table = _Table(column_names=_column_names(keys), row_count=len(data))
    for record in scanned:
        table.rows.append([_json_cell(record.get(key)) for key in keys])
    return table


def _json_cell(value: object) -> Cell:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, str):
        return _clip(value.strip()) or None
    return _clip(json.dumps(value, ensure_ascii=False))


def _clip(value: str) -> str:
    if len(value) <= MAX_CELL_LENGTH:
        return value
    return value[: MAX_CELL_LENGTH - 1] + "…"


def _number(cell: Cell) -> int | float | None:
    """Return the cell as a number, or None when it is not a plain number."""
    if isinstance(cell, bool) or cell is None:
        return None
    if isinstance(cell, (int, float)):
        return cell
    if not NUMBER_PATTERN.match(cell):
        return None
    number = float(cell)
    if not math.isfinite(number):
        return None
    return int(number) if number.is_integer() and "." not in cell and "e" not in cell.lower() else number


def _describe_column(name: str, cells: list[Cell]) -> PreviewColumn:
    values = [cell for cell in cells if cell is not None]
    if not values:
        return PreviewColumn(name=name, type="empty", statistics=None)

    numbers = [_number(cell) for cell in values]
    if any(number is None for number in numbers):
        return PreviewColumn(name=name, type="text", statistics=None)

    return PreviewColumn(
        name=name,
        type="number",
        statistics=ColumnStatistics(
            count=len(numbers),
            minimum=min(numbers),
            maximum=max(numbers),
            mean=math.fsum(numbers) / len(numbers),
        ),
    )
