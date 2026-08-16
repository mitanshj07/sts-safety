# services/ai/app/features.py
"""
Fixed-order 18-feature extractor for a ping window.

Keep this tuple byte-identical to `packages/shared/src/constants/feature-vector.ts`.
The IsolationForest (and the browser-side ONNX fallback) consume features in this
order and no other.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence

import numpy as np

from app.config import (
    DEFAULT_CORRIDOR_M,
    N_FEATURES,
    SCORE_NIGHT_END_HOUR_IST,
    SCORE_NIGHT_START_HOUR_IST,
)
from app.geo import bearing, haversine, point_in_polygon, point_to_linestring_m
from app.models.stop_detection import StopResult, detect_stops, ist_hour
from app.schemas import ItineraryIn, PingIn, ZoneIn

# Canonical order — 18 floats, always. Do not reorder without bumping MODEL_VERSION.
FEATURE_NAMES: tuple[str, ...] = (
    "speed_mean_mps",
    "speed_std_mps",
    "speed_max_mps",
    "accel_std_mps2",
    "bearing_change_entropy",
    "stop_count",
    "stop_duration_s",
    "itinerary_distance_m",
    "radius_of_gyration_m",
    "straightness_index",
    "night_fraction",
    "zone_risk_weighted_dwell",
    "ping_gap_mean_s",
    "ping_gap_max_s",
    "battery_slope_pct_per_h",
    "total_distance_m",
    "window_duration_s",
    "n_pings",
)

assert len(FEATURE_NAMES) == N_FEATURES

FEATURE_INDEX: dict[str, int] = {name: i for i, name in enumerate(FEATURE_NAMES)}

RISK_WEIGHT = {
    "none": 0.0,
    "low": 0.25,
    "medium": 0.5,
    "high": 0.75,
    "critical": 1.0,
}

_ENTROPY_BINS = 8


@dataclass(frozen=True)
class WindowFeatures:
    vector: tuple[float, ...]
    stops: StopResult

    def as_array(self) -> np.ndarray:
        return np.asarray(self.vector, dtype=np.float64)

    def as_dict(self) -> dict[str, float]:
        return {name: self.vector[i] for i, name in enumerate(FEATURE_NAMES)}


def _aware(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def _safe_std(values: np.ndarray) -> float:
    if values.size < 2:
        return 0.0
    return float(np.std(values, ddof=0))


def _shannon_entropy_norm(values: np.ndarray, bins: int, lo: float, hi: float) -> float:
    if values.size == 0:
        return 0.0
    counts, _ = np.histogram(values, bins=bins, range=(lo, hi))
    total = int(counts.sum())
    if total == 0:
        return 0.0
    probs = counts.astype(np.float64) / float(total)
    probs = probs[probs > 0]
    ent = float(-(probs * np.log2(probs)).sum())
    return ent / np.log2(bins)


def _max_zone_weight(lat: float, lon: float, zones: Sequence[ZoneIn]) -> float:
    best = 0.0
    for zone in zones:
        if not zone.geom:
            continue
        if point_in_polygon(lat, lon, zone.geom):
            w = RISK_WEIGHT.get(zone.risk_level, 0.0)
            if w > best:
                best = w
    return best


def extract_features(
    pings: Sequence[PingIn],
    itinerary: ItineraryIn | None = None,
    zones: Sequence[ZoneIn] | None = None,
) -> WindowFeatures:
    """Build the 18-feature vector from a time-ordered ping window."""
    zones = list(zones or [])
    ordered = sorted(pings, key=lambda p: _aware(p.recorded_at))
    n = len(ordered)
    zeros = tuple(0.0 for _ in FEATURE_NAMES)
    if n == 0:
        return WindowFeatures(vector=zeros, stops=StopResult())

    times = np.array(
        [_aware(p.recorded_at).timestamp() for p in ordered], dtype=np.float64
    )
    lats = np.array([p.lat for p in ordered], dtype=np.float64)
    lons = np.array([p.lon for p in ordered], dtype=np.float64)
    window_duration_s = float(max(0.0, times[-1] - times[0])) if n else 0.0

    # --- speeds (device reading, else derived) ---
    speeds = np.zeros(n, dtype=np.float64)
    derived_heading = np.full(n, np.nan, dtype=np.float64)
    segment_dist = np.zeros(max(n - 1, 0), dtype=np.float64)
    for i, ping in enumerate(ordered):
        if ping.speed_mps is not None:
            speeds[i] = float(ping.speed_mps)
        elif i > 0:
            dt = max(times[i] - times[i - 1], 1e-6)
            d = haversine(lats[i - 1], lons[i - 1], lats[i], lons[i])
            speeds[i] = d / dt
        if i > 0:
            segment_dist[i - 1] = haversine(
                lats[i - 1], lons[i - 1], lats[i], lons[i]
            )
            derived_heading[i] = bearing(
                lats[i - 1], lons[i - 1], lats[i], lons[i]
            )

    speed_mean = float(np.mean(speeds))
    speed_std = _safe_std(speeds)
    speed_max = float(np.max(speeds)) if n else 0.0

    # --- acceleration std ---
    accels: list[float] = []
    for i in range(1, n):
        dt = times[i] - times[i - 1]
        if dt <= 1e-6:
            continue
        accels.append((speeds[i] - speeds[i - 1]) / dt)
    accel_std = _safe_std(np.asarray(accels, dtype=np.float64)) if accels else 0.0

    # --- bearing-change entropy ---
    headings = np.zeros(n, dtype=np.float64)
    for i, ping in enumerate(ordered):
        if ping.heading_deg is not None:
            headings[i] = float(ping.heading_deg)
        elif not np.isnan(derived_heading[i]):
            headings[i] = float(derived_heading[i])
        elif i > 0:
            headings[i] = headings[i - 1]
    deltas: list[float] = []
    for i in range(1, n):
        d = (headings[i] - headings[i - 1] + 180.0) % 360.0 - 180.0
        deltas.append(d)
    bearing_entropy = _shannon_entropy_norm(
        np.asarray(deltas, dtype=np.float64), _ENTROPY_BINS, -180.0, 180.0
    )

    # --- itinerary distance (mean of per-ping distances to the LineString) ---
    coords = itinerary.coordinates if itinerary is not None else []
    corridor_m = float(itinerary.corridor_m) if itinerary is not None else float(
        DEFAULT_CORRIDOR_M
    )
    if coords:
        itinerary_dists = [
            point_to_linestring_m(float(lat), float(lon), coords)
            for lat, lon in zip(lats, lons)
        ]
        itinerary_distance_m = float(np.mean(itinerary_dists))
    else:
        itinerary_distance_m = 0.0

    waypoints = itinerary.waypoints if itinerary is not None else []
    stops = detect_stops(
        ordered,
        zones=zones,
        waypoints=waypoints,
        itinerary_distance_m=itinerary_distance_m,
        corridor_m=corridor_m,
    )

    # --- radius of gyration ---
    centroid_lat = float(np.mean(lats))
    centroid_lon = float(np.mean(lons))
    rg_sq = [
        haversine(float(lat), float(lon), centroid_lat, centroid_lon) ** 2
        for lat, lon in zip(lats, lons)
    ]
    radius_of_gyration_m = float(np.sqrt(np.mean(rg_sq))) if rg_sq else 0.0

    # --- straightness = net / gross ---
    total_distance_m = float(segment_dist.sum()) if n > 1 else 0.0
    net = (
        haversine(float(lats[0]), float(lons[0]), float(lats[-1]), float(lons[-1]))
        if n > 1
        else 0.0
    )
    if total_distance_m <= 1e-6:
        straightness = 1.0 if net <= 1e-6 else 0.0
    else:
        straightness = float(min(1.0, net / total_distance_m))

    # --- night fraction (IST, same bounds as the SQL safety score) ---
    if n == 1:
        hour = ist_hour(ordered[0].recorded_at)
        night_fraction = (
            1.0
            if hour >= SCORE_NIGHT_START_HOUR_IST or hour < SCORE_NIGHT_END_HOUR_IST
            else 0.0
        )
    else:
        night_s = 0.0
        for i in range(n - 1):
            dt = max(0.0, times[i + 1] - times[i])
            hour = ist_hour(ordered[i].recorded_at)
            if hour >= SCORE_NIGHT_START_HOUR_IST or hour < SCORE_NIGHT_END_HOUR_IST:
                night_s += dt
        night_fraction = (
            float(night_s / window_duration_s) if window_duration_s > 0 else 0.0
        )

    # --- zone-risk-weighted dwell (0–1) ---
    if n == 1 or window_duration_s <= 0 or not zones:
        zone_risk_dwell = _max_zone_weight(float(lats[-1]), float(lons[-1]), zones)
    else:
        weighted = 0.0
        for i in range(n - 1):
            dt = max(0.0, times[i + 1] - times[i])
            weighted += dt * _max_zone_weight(float(lats[i]), float(lons[i]), zones)
        zone_risk_dwell = float(weighted / window_duration_s)

    # --- ping gaps ---
    if n < 2:
        gap_mean = 0.0
        gap_max = 0.0
    else:
        gaps = np.diff(times)
        gaps = gaps[gaps >= 0]
        gap_mean = float(np.mean(gaps)) if gaps.size else 0.0
        gap_max = float(np.max(gaps)) if gaps.size else 0.0

    # --- battery slope (pct per hour) ---
    batt_t: list[float] = []
    batt_v: list[float] = []
    t0 = times[0]
    for ping, ts in zip(ordered, times):
        if ping.battery_pct is None:
            continue
        batt_t.append((ts - t0) / 3600.0)
        batt_v.append(float(ping.battery_pct))
    if len(batt_v) >= 2 and (max(batt_t) - min(batt_t)) > 1e-9:
        slope = float(np.polyfit(np.asarray(batt_t), np.asarray(batt_v), 1)[0])
    else:
        slope = 0.0

    vector = (
        speed_mean,
        speed_std,
        speed_max,
        accel_std,
        bearing_entropy,
        float(stops.stop_count),
        float(stops.total_stop_duration_s),
        itinerary_distance_m,
        radius_of_gyration_m,
        straightness,
        night_fraction,
        zone_risk_dwell,
        gap_mean,
        gap_max,
        slope,
        total_distance_m,
        window_duration_s,
        float(n),
    )
    assert len(vector) == N_FEATURES
    return WindowFeatures(vector=vector, stops=stops)
