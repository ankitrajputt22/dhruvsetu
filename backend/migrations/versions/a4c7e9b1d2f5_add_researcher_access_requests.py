"""Add researcher access requests

Revision ID: a4c7e9b1d2f5
Revises: f3b8d2a6c1e4
Create Date: 2026-10-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4c7e9b1d2f5"
down_revision: Union[str, Sequence[str], None] = "f3b8d2a6c1e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "researcher_access_requests",
        sa.Column("user_id", sa.CHAR(length=36), nullable=False),
        sa.Column("institution", sa.String(length=200), nullable=False),
        sa.Column("research_area", sa.String(length=120), nullable=False),
        sa.Column("designation", sa.String(length=120), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("profile_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("researcher_access_requests")
