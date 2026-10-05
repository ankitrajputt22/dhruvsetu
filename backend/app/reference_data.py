"""Put the bundled reference files into the data folder when they are missing.

The API does this every time it starts (see app/main.py). It can also be run
by hand:

    python -m app.reference_data

The production image keeps a read-only copy of the repository's reference
files (the real source documents and datasets) in backend/reference_data. The
data folder itself is a persistent volume on the server, and on some hosts a
new volume starts empty and hides whatever the image had in that place.

This copies each reference file that is not in the data folder yet. A file
that is already there is never replaced, and nothing is ever deleted, so
uploads and anything changed on the server stay as they are.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REFERENCE_ROOT = BACKEND_ROOT / "reference_data"
DATA_ROOT = BACKEND_ROOT / "data"


def restore_reference_files(
    reference_root: Path | None = None,
    data_root: Path | None = None,
) -> list[str]:
    """Copy the missing reference files. Returns the files that were copied."""
    reference_root = reference_root or REFERENCE_ROOT
    data_root = data_root or DATA_ROOT
    copied: list[str] = []
    if not reference_root.is_dir():
        # A development checkout has no reference folder: the files are
        # already in the data folder.
        return copied

    for source in sorted(reference_root.rglob("*")):
        if not source.is_file() or source.name.startswith("."):
            continue
        relative = source.relative_to(reference_root)
        destination = data_root / relative
        if destination.exists():
            continue

        destination.parent.mkdir(parents=True, exist_ok=True)
        # Copied under another name first, so a copy that is interrupted
        # never leaves half a file under the real name.
        temporary = destination.with_name(f".{destination.name}.copying")
        try:
            shutil.copyfile(source, temporary)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
        copied.append(relative.as_posix())
    return copied


def main() -> None:
    try:
        copied = restore_reference_files()
    except OSError as error:
        # The API still starts. Documents whose file is missing say so.
        print(f"Reference files could not be restored: {error}")
        return
    if copied:
        print(f"Restored {len(copied)} reference file(s) to the data folder:")
        for name in copied:
            print(f"- {name}")
    else:
        print("Reference files: nothing to restore.")


if __name__ == "__main__":
    main()
