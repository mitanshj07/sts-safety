# services/ai/app/models/stop_detection.py
"""DBSCAN stop-point clustering (eps=50 m) + accommodation vs roadside labels."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Sequence

import numpy as np
from sklearn.cluster import DBSCAN

from app.config import (
    ANOMALOUS_STOP_S,
    SCORE_NIGHT_END_HOUR_IST,
    SCORE_NIGHT_START_HOUR_IST,
    STOP_EPS_M,
    STOP_MAX_SPEED_MPS,
    STOP_MIN_SAMPLES,
    WAYPOINT_MATCH_M,
)
from app.geo import haversine, pairwise_haversine_m, point_in_polygon
from app.schemas import PingIn, StopKind, WaypointIn, ZoneIn

IST = timezone(timedelta(hours=5, minutes=30))

RISK_RANK = {"none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


@dataclass(frozen=True)
class Stop:
    centroid_lat: float
    centroid_lon: float
    start: datetime
    end: datetime
    duration_s: float
    n_pings: int
    mean_speed_mps: float
    kind: StopKind


@dataclass
class StopResult:
    stops: list[Stop] = field(default_factory=list)
    stop_count: int = 0
    total_stop_duration_s: float = 0.0
    in_accommodation: bool = False
    has_anomalous_roadside: bool = False


def _aware(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def ist_hour(ts: datetime) -> int:
    return _aware(ts).astimezone(IST).hour


def is_score_night(ts: datetime) -> bool:
    hour = ist_hour(ts)
    return hour >= SCORE_NIGHT_START_HOUR_IST or hour < SCORE_NIGHT_END_HOUR_IST


def _in_zones(lat: float, lon: float, zones: Sequence[ZoneIn]) -> list[ZoneIn]:
    hit: list[ZoneIn] = []
    for zone in zones:
        if zone.geom and len(zone.geom) > 0:
            if point_in_polygon(lat, lon, zone.geom):
                hit.append(zone)
        # If a zone has no geometry, it cannot contribute spatially.
    return hit


def _classify(
    centroid_lat: float,
    centroid_lon: float,
    duration_s: float,
    start: datetime,
    zones: Sequence[ZoneIn],
    waypoints: Sequence[WaypointIn],
    itinerary_distance_m: float,
    corridor_m: float,
) -> StopKind:
    containing = _in_zones(centroid_lat, centroid_lon, zones)
    if any(z.category == "accommodation" for z in containing):
        return "accommodation"

    for wp in waypoints:
        if haversine(centroid_lat, centroid_lon, wp.lat, wp.lon) <= WAYPOINT_MATCH_M:
            return "waypoint"

    if duration_s < ANOMALOUS_STOP_S:
        return "pause"

    night = is_score_night(start)
    off_route = itinerary_distance_m > corridor_m
    if night or off_route:
        return "anomalous_roadside"
    return "roadside"


def detect_stops(
    pings: Sequence[PingIn],
    *,
    zones: Sequence[ZoneIn] | None = None,
    waypoints: Sequence[WaypointIn] | None = None,
    itinerary_distance_m: float = 0.0,
    corridor_m: float = 2000.0,
    eps_m: float = STOP_EPS_M,
    min_samples: int = STOP_MIN_SAMPLES,
) -> StopResult:
    """Cluster a ping window into stops. Empty / singleton windows yield no stops."""
    zones = zones or []
    waypoints = waypoints or []
    n = len(pings)
    if n < min_samples:
        return StopResult()

    ordered = sorted(pings, key=lambda p: _aware(p.recorded_at))
    lats = np.array([p.lat for p in ordered], dtype=np.float64)
    lons = np.array([p.lon for p in ordered], dtype=np.float64)
    dist = pairwise_haversine_m(lats, lons)
    clustering = DBSCAN(eps=eps_m, min_samples=min_samples, metric="precomputed")
    labels = clustering.fit_predict(dist)

    stops: list[Stop] = []
    for label in sorted(set(labels.tolist())):
        if label < 0:
            continue
        idx = np.where(labels == label)[0]
        cluster = [ordered[int(i)] for i in idx]
        times = [_aware(p.recorded_at) for p in cluster]
        start, end = min(times), max(times)
        duration_s = max(0.0, (end - start).total_seconds())
        speeds: list[float] = []
        for p in cluster:
            if p.speed_mps is not None:
                speeds.append(float(p.speed_mps))
        mean_speed = float(np.mean(speeds)) if speeds else 0.0
        if mean_speed > STOP_MAX_SPEED_MPS and duration_s < 60.0:
            continue
        centroid_lat = float(np.mean([p.lat for p in cluster]))
        centroid_lon = float(np.mean([p.lon for p in cluster]))
        kind = _classify(
            centroid_lat,
            centroid_lon,
            duration_s,
            start,
            zones,
            waypoints,
            itinerary_distance_m,
            corridor_m,
        )
        stops.append(
            Stop(
                centroid_lat=centroid_lat,
                centroid_lon=centroid_lon,
                start=start,
                end=end,
                duration_s=duration_s,
                n_pings=len(cluster),
                mean_speed_mps=mean_speed,
                kind=kind,
            )
        )

    real_stops = [s for s in stops if s.kind != "pause" or s.duration_s >= 60.0]
    total = float(sum(s.duration_s for s in real_stops))
    in_acc = any(s.kind in ("accommodation", "waypoint") for s in real_stops)
    anomalous = any(s.kind == "anomalous_roadside" for s in real_stops)
    return StopResult(
        stops=real_stops,
        stop_count=len(real_stops),
        total_stop_duration_s=total,
        in_accommodation=in_acc,
        has_anomalous_roadside=anomalous,
    )
