from __future__ import annotations

from decimal import Decimal

# Simple latitude rules used only to group map locations by polar region.
# Antarctic: south of 60 degrees south. Arctic: north of the Arctic Circle.
ANTARCTIC_MAX_LATITUDE = -60.0
ARCTIC_MIN_LATITUDE = 66.5
# A standard web map cannot draw points closer to the poles than this.
WEB_MAP_LATITUDE_LIMIT = 85.0

Number = Decimal | float | int | None


def valid_coordinates(latitude: Number, longitude: Number) -> tuple[float, float] | None:
    """Return the stored coordinates, or None when they are missing or impossible."""
    if latitude is None or longitude is None:
        return None
    lat, lng = float(latitude), float(longitude)
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return lat, lng


def polar_region(latitude: float | None) -> str | None:
    """Group a latitude into a polar region. Names are never used for this."""
    if latitude is None:
        return None
    if latitude <= ANTARCTIC_MAX_LATITUDE:
        return "antarctic"
    if latitude >= ARCTIC_MIN_LATITUDE:
        return "arctic"
    return None


def fits_web_map(latitude: float | None) -> bool:
    return latitude is not None and abs(latitude) <= WEB_MAP_LATITUDE_LIMIT
