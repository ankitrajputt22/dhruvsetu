"""Add dataset file name

Revision ID: e7a9c1f4b2d6
Revises: d4c2b3a1e9f0
Create Date: 2026-10-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7a9c1f4b2d6"
down_revision: Union[str, Sequence[str], None] = "d4c2b3a1e9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("file_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("datasets", "file_name")
