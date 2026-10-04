"""Reading one uploaded file and its form fields safely."""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as FormRefused
from starlette.formparsers import MultiPartException
from starlette.requests import Request

# Room for the form fields and the multipart framing around the file.
FORM_OVERHEAD_BYTES = 64 * 1024
MAX_FORM_FIELDS = 20
MAX_FIELD_BYTES = 16 * 1024


class UploadRejected(Exception):
    """The upload was refused. The message is safe to show."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class UploadedFile:
    # A cleaned name without any folder part. It is only used as a label and
    # for its file type; stored files get names made by the server.
    name: str
    file_type: str
    data: bytes


def safe_file_name(raw: str | None) -> tuple[str, str]:
    """Return a harmless file name and its file type.

    Folder parts are dropped, so a name such as "../../x.pdf" becomes "x.pdf".
    """
    name = (raw or "").replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFKC", name)
    name = "".join(
        character if character.isalnum() or character in "._- " else "_"
        for character in name
    ).strip(" .")
    stem, dot, suffix = name.rpartition(".")
    if not dot or not stem.strip(" ._") or not suffix:
        raise UploadRejected(
            422, "The file needs a name with a file type, for example notes.pdf."
        )
    file_type = suffix.casefold()
    return f"{stem[:120]}.{file_type}", file_type


def megabytes(size: int) -> str:
    return f"{size // (1024 * 1024)} MB"


async def read_upload(
    request: Request,
    *,
    max_file_bytes: int,
) -> tuple[dict[str, str], UploadedFile]:
    """Read the form fields and the single file of a multipart request.

    The size is checked before anything is read and again while reading, so a
    large upload is refused instead of being stored.
    """
    too_large = UploadRejected(413, f"The file is larger than {megabytes(max_file_bytes)}.")
    length = request.headers.get("content-length", "")
    if not length.isdigit():
        raise UploadRejected(411, "The upload did not say how large it is.")
    if int(length) > max_file_bytes + FORM_OVERHEAD_BYTES:
        raise too_large
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        raise UploadRejected(415, "Send the file as a form upload.")

    try:
        form = await request.form(
            max_files=1, max_fields=MAX_FORM_FIELDS, max_part_size=MAX_FIELD_BYTES
        )
    except (MultiPartException, FormRefused) as error:
        # Too many files or fields, or a form that cannot be read.
        raise UploadRejected(
            422, "The upload could not be read. Send the form with one file."
        ) from error

    fields: dict[str, str] = {}
    upload: UploadFile | None = None
    for name, value in form.multi_items():
        if isinstance(value, UploadFile):
            if name != "file" or upload is not None:
                raise UploadRejected(422, "Send one file, in the field named file.")
            upload = value
        elif name in fields:
            raise UploadRejected(422, f"The field {name} was sent more than once.")
        else:
            fields[name] = value
    if upload is None:
        raise UploadRejected(422, "Choose a file to upload.")

    data = await upload.read(max_file_bytes + 1)
    if len(data) > max_file_bytes:
        raise too_large
    if not data:
        raise UploadRejected(422, "The file is empty.")
    name, file_type = safe_file_name(upload.filename)
    return fields, UploadedFile(name=name, file_type=file_type, data=data)
