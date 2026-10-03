from app.database import SessionLocal
from app.search.semantic import INDEX_DIR, MODEL_NAME, build_semantic_index


def main() -> None:
    with SessionLocal() as session:
        record_count = build_semantic_index(session)

    print(f"Built semantic index for {record_count} records.")
    print(f"Model: {MODEL_NAME}")
    print(f"Index: {INDEX_DIR}")


if __name__ == "__main__":
    main()
