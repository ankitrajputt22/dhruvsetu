"""Create or update local accounts from environment variables.

Set the email and password for each account in the root .env file, then run:

    python -m app.auth.seed_accounts

Accounts whose email or password is not set are skipped. No password is ever
written to the output.
"""
from __future__ import annotations

import os

from sqlalchemy import select

from app.auth import config
from app.auth.passwords import hash_password
from app.auth.sessions import end_all_sessions_for
from app.database import SessionLocal
from app.models import User

# role -> (email variable, password variable, display name)
ACCOUNTS = {
    "admin": ("SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD", "DhruvSetu Admin"),
    "researcher": ("SEED_RESEARCHER_EMAIL", "SEED_RESEARCHER_PASSWORD", "Demo Researcher"),
    "user": ("SEED_USER_EMAIL", "SEED_USER_PASSWORD", "Demo User"),
}


def seed_accounts() -> list[str]:
    messages = []
    with SessionLocal() as db:
        for role, (email_name, password_name, display_name) in ACCOUNTS.items():
            email = os.getenv(email_name, "").strip().lower()
            password = os.getenv(password_name, "")
            if not email or not password:
                messages.append(f"{role}: skipped ({email_name} or {password_name} is not set)")
                continue
            if not config.MIN_PASSWORD_LENGTH <= len(password) <= config.MAX_PASSWORD_LENGTH:
                messages.append(
                    f"{role}: skipped ({password_name} must be "
                    f"{config.MIN_PASSWORD_LENGTH} to {config.MAX_PASSWORD_LENGTH} characters)"
                )
                continue

            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(email=email, display_name=display_name)
                db.add(user)
                action = "created"
            else:
                # A changed password signs the account out everywhere.
                end_all_sessions_for(db, user.id)
                action = "updated"
            user.password_hash = hash_password(password)
            user.role = role
            user.is_active = True
            db.commit()
            messages.append(f"{role}: {action} {email}")
    return messages


def main() -> None:
    print("DhruvSetu accounts:")
    for message in seed_accounts():
        print(f"- {message}")


if __name__ == "__main__":
    main()
