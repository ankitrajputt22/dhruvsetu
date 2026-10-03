from __future__ import annotations

import argparse
from pathlib import Path

from app.database import SessionLocal
from app.datasets.files import DatasetFileError, attach_dataset_file


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Attach a data file to an existing dataset record"
    )
    parser.add_argument("dataset_id")
    parser.add_argument("file", type=Path)
    args = parser.parse_args()

    try:
        with SessionLocal() as session:
            stored = attach_dataset_file(session, args.dataset_id, args.file)
    except DatasetFileError as error:
        raise SystemExit(f"File was not attached: {error}") from error

    print(f"Attached file: {stored.file_name}")
    print(f"File type: {stored.file_type}")
    print(f"Size: {stored.size_bytes} bytes")


if __name__ == "__main__":
    main()
