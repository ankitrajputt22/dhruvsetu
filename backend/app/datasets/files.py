from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Dataset

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATASET_STORE = BACKEND_ROOT / "data" / "datasets"

# Files that can be shown as a table, and files that can only be downloaded.
PREVIEW_FILE_TYPES = ("csv", "json")
DATASET_FILE_TYPES = PREVIEW_FILE_TYPES + ("txt", "xlsx", "nc", "h5", "zip")
MAX_DATASET_FILE_BYTES = 200 * 1024 * 1024


class DatasetFileError(ValueError):
    pass


@dataclass(frozen=True)
class DatasetFile:
    path: Path
    file_name: str
    file_type: str
    size_bytes: int


def file_type_of(file_name: str) -> str:
    return Path(file_name).suffix.casefold().lstrip(".")


def find_dataset_file(dataset: Dataset) -> DatasetFile | None:
    """Return the stored file for a dataset, or None when there is no usable file.

    The file name comes from the database record and must be a plain name
    inside the dataset store. Anything else is treated as having no file.
    """
    name = dataset.file_name
    if not name or name != Path(name).name or "\\" in name or name.startswith("."):
        return None

    file_type = file_type_of(name)
    if file_type not in DATASET_FILE_TYPES:
        return None

    store = DATASET_STORE.resolve()
    path = (store / name).resolve()
    if path.parent != store or not path.is_file():
        return None

    return DatasetFile(
        path=path,
        file_name=name,
        file_type=file_type,
        size_bytes=path.stat().st_size,
    )


def attach_dataset_file(
    session: Session,
    dataset_id: str,
    file_path: Path,
) -> DatasetFile:
    """Copy a data file into the dataset store and link it to a dataset."""
    source = file_path.expanduser().resolve()
    if not source.is_file():
        raise DatasetFileError("The dataset file does not exist")

    file_type = file_type_of(source.name)
    if file_type not in DATASET_FILE_TYPES:
        supported = ", ".join(item.upper() for item in DATASET_FILE_TYPES)
        raise DatasetFileError(f"Only these file types are supported: {supported}")
    if source.stat().st_size > MAX_DATASET_FILE_BYTES:
        raise DatasetFileError("The dataset file is larger than 200 MB")

    dataset = session.get(Dataset, dataset_id)
    if dataset is None:
        raise DatasetFileError("The dataset was not found")

    store = DATASET_STORE.resolve()
    store.mkdir(parents=True, exist_ok=True)
    stored_name = f"{dataset.id}.{file_type}"
    destination = store / stored_name
    if source != destination:
        shutil.copy2(source, destination)

    dataset.file_name = stored_name
    dataset.file_type = file_type
    session.commit()

    return DatasetFile(
        path=destination,
        file_name=stored_name,
        file_type=file_type,
        size_bytes=destination.stat().st_size,
    )
