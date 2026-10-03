from __future__ import annotations

from dataclasses import dataclass

from app.database import SessionLocal
from app.ingestion.service import DOCUMENT_STORE, ingest_document
from app.seed import DEMO_IDS, seed_demo_data


@dataclass(frozen=True)
class DemoDocument:
    file_name: str
    title: str
    relationship: str
    related_id: str


DEMO_DOCUMENTS = (
    DemoDocument(
        file_name="demo-antarctic-climate.txt",
        title="Demo Antarctic Climate Field Notes",
        relationship="report_id",
        related_id=DEMO_IDS["reports"]["climate"],
    ),
    DemoDocument(
        file_name="demo-sea-ice-observations.txt",
        title="Demo Sea Ice Observation Notes",
        relationship="expedition_id",
        related_id=DEMO_IDS["expeditions"]["sea-ice"],
    ),
    DemoDocument(
        file_name="demo-polar-biodiversity.txt",
        title="Prototype Polar Biodiversity Field Guide Notes",
        relationship="publication_id",
        related_id=DEMO_IDS["publications"]["biodiversity"],
    ),
)


def seed_demo_documents() -> tuple[int, int]:
    created = 0
    chunk_count = 0
    with SessionLocal() as session:
        seed_demo_data(session)
        for item in DEMO_DOCUMENTS:
            result = ingest_document(
                session,
                DOCUMENT_STORE / item.file_name,
                title=item.title,
                source_type="prototype",
                verification_status="uploaded",
                is_demo_data=True,
                **{item.relationship: item.related_id},
            )
            created += int(not result.duplicate)
            chunk_count += result.chunk_count
    return created, chunk_count


def main() -> None:
    created, chunk_count = seed_demo_documents()
    print("DhruvSetu demo source documents are ready:")
    print(f"- Documents available: {len(DEMO_DOCUMENTS)}")
    print(f"- Documents newly ingested: {created}")
    print(f"- Chunks available: {chunk_count}")


if __name__ == "__main__":
    main()
