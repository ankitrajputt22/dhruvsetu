"""Add researcher request decisions and record submitters

Revision ID: b6d1f3a8c2e7
Revises: a4c7e9b1d2f5
Create Date: 2026-10-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6d1f3a8c2e7"
down_revision: Union[str, Sequence[str], None] = "a4c7e9b1d2f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REQUESTS = "researcher_access_requests"


def upgrade() -> None:
    # A person can now have more than one request over time, so the account is
    # no longer unique in this table. The new index takes over from the old
    # unique one before that is removed.
    op.create_index(op.f("ix_researcher_access_requests_user_id"), REQUESTS, ["user_id"])
    op.drop_constraint("user_id", REQUESTS, type_="unique")

    # Requests saved before this change become pending.
    op.add_column(
        REQUESTS,
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
    )
    op.add_column(REQUESTS, sa.Column("decided_by_user_id", sa.CHAR(length=36), nullable=True))
    op.add_column(REQUESTS, sa.Column("decided_at", sa.DateTime(), nullable=True))
    op.add_column(REQUESTS, sa.Column("decision_note", sa.String(length=500), nullable=True))
    op.create_check_constraint(
        "ck_researcher_access_requests_status",
        REQUESTS,
        "status in ('pending', 'approved', 'rejected')",
    )
    op.create_index(op.f("ix_researcher_access_requests_status"), REQUESTS, ["status"])
    op.create_index(
        op.f("ix_researcher_access_requests_decided_by_user_id"),
        REQUESTS,
        ["decided_by_user_id"],
    )
    op.create_foreign_key(
        "fk_researcher_access_requests_decided_by",
        REQUESTS,
        "users",
        ["decided_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Who submitted a document or a dataset. Empty for existing records.
    for table in ("documents", "datasets"):
        op.add_column(table, sa.Column("submitted_by_user_id", sa.CHAR(length=36), nullable=True))
        op.create_index(op.f(f"ix_{table}_submitted_by_user_id"), table, ["submitted_by_user_id"])
        op.create_foreign_key(
            f"fk_{table}_submitted_by",
            table,
            "users",
            ["submitted_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    for table in ("datasets", "documents"):
        op.drop_constraint(f"fk_{table}_submitted_by", table, type_="foreignkey")
        op.drop_index(op.f(f"ix_{table}_submitted_by_user_id"), table_name=table)
        op.drop_column(table, "submitted_by_user_id")

    op.drop_constraint("fk_researcher_access_requests_decided_by", REQUESTS, type_="foreignkey")
    op.drop_index(op.f("ix_researcher_access_requests_decided_by_user_id"), table_name=REQUESTS)
    op.drop_index(op.f("ix_researcher_access_requests_status"), table_name=REQUESTS)
    op.drop_constraint("ck_researcher_access_requests_status", REQUESTS, type_="check")
    op.drop_column(REQUESTS, "decision_note")
    op.drop_column(REQUESTS, "decided_at")
    op.drop_column(REQUESTS, "decided_by_user_id")
    op.drop_column(REQUESTS, "status")

    # The older layout allows one request for an account, so only the newest
    # request of each account is kept.
    op.execute(
        """
        DELETE older FROM researcher_access_requests AS older
        JOIN researcher_access_requests AS newer
          ON older.user_id = newer.user_id
         AND (older.created_at < newer.created_at
              OR (older.created_at = newer.created_at AND older.id < newer.id))
        """
    )
    op.create_unique_constraint("user_id", REQUESTS, ["user_id"])
    op.drop_index(op.f("ix_researcher_access_requests_user_id"), table_name=REQUESTS)
