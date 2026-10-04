"""Add source fields for real records

Revision ID: c8e2a5f7d1b3
Revises: b6d1f3a8c2e7
Create Date: 2026-10-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8e2a5f7d1b3"
down_revision: Union[str, Sequence[str], None] = "b6d1f3a8c2e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Where a real record comes from, and how a real paper is cited.
COLUMNS = (
    ("scientists", "designation", sa.String(length=255)),
    ("scientists", "profile_url", sa.String(length=2048)),
    ("expeditions", "source_url", sa.String(length=2048)),
    ("research_stations", "source_url", sa.String(length=2048)),
    ("publications", "authors", sa.Text()),
    ("publications", "journal", sa.String(length=255)),
)


def upgrade() -> None:
    for table, column, column_type in COLUMNS:
        op.add_column(table, sa.Column(column, column_type, nullable=True))


def downgrade() -> None:
    for table, column, _ in reversed(COLUMNS):
        op.drop_column(table, column)
