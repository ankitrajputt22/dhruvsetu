"""Add document sources

Revision ID: d4c2b3a1e9f0
Revises: ab6197fa7f6f
Create Date: 2026-10-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4c2b3a1e9f0"
down_revision: Union[str, Sequence[str], None] = "ab6197fa7f6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=10), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("publication_date", sa.Date(), nullable=True),
        sa.Column("publication_id", sa.CHAR(length=36), nullable=True),
        sa.Column("report_id", sa.CHAR(length=36), nullable=True),
        sa.Column("expedition_id", sa.CHAR(length=36), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column(
            "verification_status",
            sa.String(length=20),
            server_default="uploaded",
            nullable=False,
        ),
        sa.Column(
            "is_demo_data",
            sa.Boolean(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["publication_id"], ["publications.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["expedition_id"], ["expeditions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_hash"),
    )
    op.create_index(
        op.f("ix_documents_expedition_id"),
        "documents",
        ["expedition_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_documents_publication_id"),
        "documents",
        ["publication_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_documents_report_id"),
        "documents",
        ["report_id"],
        unique=False,
    )

    op.create_table(
        "document_chunks",
        sa.Column("document_id", sa.CHAR(length=36), nullable=False),
        sa.Column("chunk_number", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("section_name", sa.String(length=255), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["document_id"], ["documents.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_id",
            "chunk_number",
            name="uq_document_chunks_document_number",
        ),
    )
    op.create_index(
        op.f("ix_document_chunks_document_id"),
        "document_chunks",
        ["document_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_document_chunks_document_id"), table_name="document_chunks"
    )
    op.drop_table("document_chunks")
    op.drop_index(op.f("ix_documents_report_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_publication_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_expedition_id"), table_name="documents")
    op.drop_table("documents")
