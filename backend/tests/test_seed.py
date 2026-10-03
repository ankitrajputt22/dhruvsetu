from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.database import SessionLocal
from app.models import Dataset, Expedition, Location, MediaAsset, Publication, Report
from app.seed import DEMO_COUNTS, DEMO_IDS, seed_demo_data


def test_demo_seed_is_complete_and_idempotent() -> None:
    with SessionLocal() as session:
        first_summary = seed_demo_data(session)
        second_summary = seed_demo_data(session)

    assert first_summary == DEMO_COUNTS
    assert second_summary == DEMO_COUNTS


def test_demo_records_are_safe_and_connected() -> None:
    with SessionLocal() as session:
        seed_demo_data(session)

        demo_resources = {
            Expedition: DEMO_IDS["expeditions"].values(),
            Publication: DEMO_IDS["publications"].values(),
            Report: DEMO_IDS["reports"].values(),
            Dataset: DEMO_IDS["datasets"].values(),
            MediaAsset: DEMO_IDS["media_assets"].values(),
        }
        for model, ids in demo_resources.items():
            records = session.scalars(select(model).where(model.id.in_(ids))).all()
            assert len(records) == len(ids)
            assert all(record.is_demo_data for record in records)

        locations = session.scalars(
            select(Location).where(Location.id.in_(DEMO_IDS["locations"].values()))
        ).all()
        assert all(location.latitude is None for location in locations)
        assert all(location.longitude is None for location in locations)

        publications = session.scalars(
            select(Publication).where(
                Publication.id.in_(DEMO_IDS["publications"].values())
            )
        ).all()
        assert all(publication.doi is None for publication in publications)
        assert all(publication.source_url is None for publication in publications)
        assert all(publication.scientists for publication in publications)
        assert all(publication.research_topics for publication in publications)

        datasets = session.scalars(
            select(Dataset).where(Dataset.id.in_(DEMO_IDS["datasets"].values()))
        ).all()
        assert all(dataset.research_topics for dataset in datasets)

        for model, ids in (
            (Report, DEMO_IDS["reports"].values()),
            (Dataset, DEMO_IDS["datasets"].values()),
            (MediaAsset, DEMO_IDS["media_assets"].values()),
        ):
            source_urls = session.scalars(
                select(model.source_url).where(model.id.in_(ids))
            ).all()
            assert all(source_url is None for source_url in source_urls)

        expeditions = session.scalars(
            select(Expedition)
            .where(Expedition.id.in_(DEMO_IDS["expeditions"].values()))
            .options(
                selectinload(Expedition.scientists),
                selectinload(Expedition.research_topics),
                selectinload(Expedition.locations),
                selectinload(Expedition.publications),
                selectinload(Expedition.datasets),
                selectinload(Expedition.reports),
                selectinload(Expedition.media_assets),
            )
        ).all()

        assert len(expeditions) == DEMO_COUNTS["expeditions"]
        for expedition in expeditions:
            assert expedition.scientists
            assert expedition.research_topics
            assert expedition.locations
            assert expedition.publications
            assert expedition.datasets
            assert expedition.reports
            assert expedition.media_assets

        demo_expedition_count = session.scalar(
            select(func.count())
            .select_from(Expedition)
            .where(Expedition.id.in_(DEMO_IDS["expeditions"].values()))
        )
        assert demo_expedition_count == DEMO_COUNTS["expeditions"]
