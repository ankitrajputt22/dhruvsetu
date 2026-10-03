from __future__ import annotations

from app.models import Document
from app.schemas import RelatedDocumentResource

# Frontend routes for records a document can be linked to. None means the
# record has no page yet, so it is shown as plain text instead of a link.
RELATED_RESOURCE_ROUTES = {
    "publication": "/publications#publication-{id}",
    "report": None,
    "expedition": "/expeditions/{id}",
}


def related_document_resources(document: Document) -> list[RelatedDocumentResource]:
    resources = []
    for resource_type, record, title_attribute in (
        ("publication", document.publication, "title"),
        ("report", document.report, "title"),
        ("expedition", document.expedition, "name"),
    ):
        if record is None:
            continue
        route = RELATED_RESOURCE_ROUTES[resource_type]
        resources.append(
            RelatedDocumentResource(
                id=record.id,
                type=resource_type,
                title=getattr(record, title_attribute),
                href=route.format(id=record.id) if route is not None else None,
            )
        )
    return resources
