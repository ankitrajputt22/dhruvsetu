from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# Argon2id with the library's recommended settings.
_hasher = PasswordHasher()

# Checked when no account matches, so a wrong email takes as long as a wrong
# password and the two cannot be told apart by timing.
_DUMMY_HASH = _hasher.hash("no account uses this password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and bool(
            password_hash
        )
    except (VerificationError, InvalidHashError):
        return False
