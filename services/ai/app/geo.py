# services/ai/app/geo.py
"""Geodesy helpers matching `packages/shared/src/utils/geo.ts` (WGS-84 mean radius)."""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np

EARTH_RADIUS_M = 6_371_000.0

# (lon, lat) rings as GeoJSON: exterior first, holes after.
PolygonRings = Sequence[Sequence[tuple[float, float]]]


def to_radians(deg: float) -> float:
    return deg * math.pi / 180.0


def to_degrees(rad: float) -> float:
    return rad * 180.0 / math.pi


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres. Same formula as the TypeScript helper."""
    d_lat = to_radians(lat2 - lat1)
    d_lon = to_radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(to_radians(lat1))
        * math.cos(to_radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    a = min(1.0, max(0.0, a))
    return 2.0 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing degrees clockwise from north in [0, 360)."""
    phi1 = to_radians(lat1)
    phi2 = to_radians(lat2)
    d_lon = to_radians(lon2 - lon1)
    y = math.sin(d_lon) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(
        d_lon
    )
    return (to_degrees(math.atan2(y, x)) + 360.0) % 360.0


def pairwise_haversine_m(lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """NxN great-circle distance matrix in metres."""
    lat1 = np.radians(lats)[:, None]
    lat2 = np.radians(lats)[None, :]
    dlat = lat2 - lat1
    dlon = np.radians(lons)[None, :] - np.radians(lons)[:, None]
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    a = np.clip(a, 0.0, 1.0)
    return 2.0 * EARTH_RADIUS_M * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))


def _local_xy(
    lat: float, lon: float, lat0: float, lon0: float
) -> tuple[float, float]:
    x = EARTH_RADIUS_M * to_radians(lon - lon0) * math.cos(to_radians(lat0))
    y = EARTH_RADIUS_M * to_radians(lat - lat0)
    return x, y


def point_to_segment_m(
    lat: float,
    lon: float,
    lat_a: float,
    lon_a: float,
    lat_b: float,
    lon_b: float,
) -> float:
    """Geodesic-ish distance from a point to a segment via local equirectangular projection."""
    ax, ay = _local_xy(lat_a, lon_a, lat, lon)
    bx, by = _local_xy(lat_b, lon_b, lat, lon)
    px, py = 0.0, 0.0
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    if denom <= 1e-12:
        return haversine(lat, lon, lat_a, lon_a)
    t = ((px - ax) * dx + (py - ay) * dy) / denom
    t = min(1.0, max(0.0, t))
    cx = ax + t * dx
    cy = ay + t * dy
    # Convert closest XY back to lat/lon around the query point.
    lat_c = lat + to_degrees(cy / EARTH_RADIUS_M)
    cos_lat = math.cos(to_radians(lat))
    if abs(cos_lat) < 1e-12:
        lon_c = lon
    else:
        lon_c = lon + to_degrees(cx / (EARTH_RADIUS_M * cos_lat))
    return haversine(lat, lon, lat_c, lon_c)


def point_to_linestring_m(
    lat: float, lon: float, coordinates: Sequence[tuple[float, float]]
) -> float:
    """Min distance in metres from a point to a LineString of (lon, lat) positions."""
    if len(coordinates) == 0:
        return 0.0
    if len(coordinates) == 1:
        only = coordinates[0]
        return haversine(lat, lon, only[1], only[0])
    best = float("inf")
    for i in range(len(coordinates) - 1):
        a = coordinates[i]
        b = coordinates[i + 1]
        d = point_to_segment_m(lat, lon, a[1], a[0], b[1], b[0])
        if d < best:
            best = d
    return best if math.isfinite(best) else 0.0


def _ray_intersects(
    lon: float, lat: float, ring: Sequence[tuple[float, float]]
) -> bool:
    """Even-odd ray cast. Ring vertices are (lon, lat)."""
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersects = ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) + 1e-18) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_in_polygon(lat: float, lon: float, rings: PolygonRings) -> bool:
    """GeoJSON polygon: first ring exterior, subsequent rings holes."""
    if not rings:
        return False
    exterior = rings[0]
    if not _ray_intersects(lon, lat, exterior):
        return False
    for hole in rings[1:]:
        if _ray_intersects(lon, lat, hole):
            return False
    return True
