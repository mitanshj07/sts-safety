# services/ai/app/synthetic.py
"""Synthetic labelled windows used until Phase 10's seed CSV exists.

Expected Phase 10 files (written by tools/seed-data/generate-trajectories.ts):
  tools/seed-data/trajectories.csv
    columns: window_id,label,scenario,seq,lat,lon,recorded_at,speed_mps,heading_deg,battery_pct,accuracy_m
  tools/seed-data/labels.json
    {"windows": [{"window_id": "w0", "label": 0, "scenario": "normal-trek"}, ...]}
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

import numpy as np
import pandas as pd

from app.geo import bearing, haversine
from app.schemas import ItineraryIn, PingIn, WaypointIn, ZoneIn

REPO_ROOT = Path(__file__).resolve().parents[3]
PHASE10_CSV = REPO_ROOT / "tools" / "seed-data" / "trajectories.csv"
PHASE10_LABELS = REPO_ROOT / "tools" / "seed-data" / "labels.json"

IST = timezone(timedelta(hours=5, minutes=30))
GPS_NOISE_M = 8.0
WALK_MPS = 1.2
CAR_MPS = 11.1  # ~40 km/h

# Guwahati → Shillong (NH6-ish) and a Kaziranga loop, (lon, lat).
NH6: list[tuple[float, float]] = [
    (91.7362, 26.1445),
    (91.78, 26.05),
    (91.83, 25.88),
    (91.87, 25.70),
    (91.88, 25.5788),
]
KAZIRANGA: list[tuple[float, float]] = [
    (93.35, 26.58),
    (93.40, 26.60),
    (93.45, 26.58),
    (93.40, 26.56),
    (93.35, 26.58),
]

RESTRICTED_ZONE = ZoneIn(
    name="restricted-demo",
    category="restricted",
    risk_level="high",
    geom=[
        [
            (91.90, 25.62),
            (91.96, 25.62),
            (91.96, 25.68),
            (91.90, 25.68),
            (91.90, 25.62),
        ]
    ],
)

ACCOMMODATION_ZONE = ZoneIn(
    name="hotel-shillong",
    category="accommodation",
    risk_level="none",
    geom=[
        [
            (91.875, 25.572),
            (91.885, 25.572),
            (91.885, 25.582),
            (91.875, 25.582),
            (91.875, 25.572),
        ]
    ],
)


@dataclass(frozen=True)
class SyntheticWindow:
    window_id: str
    label: int
    scenario: str
    pings: list[PingIn]
    itinerary: ItineraryIn
    zones: list[ZoneIn]


def _offset_m(lat: float, lon: float, north_m: float, east_m: float) -> tuple[float, float]:
    dlat = north_m / 6_371_000.0 * (180.0 / math.pi)
    cos_lat = math.cos(lat * math.pi / 180.0)
    dlon = 0.0 if abs(cos_lat) < 1e-12 else (east_m / (6_371_000.0 * cos_lat)) * (
        180.0 / math.pi
    )
    return lat + dlat, lon + dlon


def _interpolate_path(
    coords: list[tuple[float, float]], n: int
) -> list[tuple[float, float]]:
    if n <= 1:
        return [coords[0]]
    dist = [0.0]
    for i in range(1, len(coords)):
        a, b = coords[i - 1], coords[i]
        dist.append(dist[-1] + haversine(a[1], a[0], b[1], b[0]))
    total = dist[-1] if dist[-1] > 0 else 1.0
    out: list[tuple[float, float]] = []
    for k in range(n):
        target = total * k / (n - 1)
        j = 1
        while j < len(dist) - 1 and dist[j] < target:
            j += 1
        span = dist[j] - dist[j - 1]
        t = 0.0 if span <= 1e-9 else (target - dist[j - 1]) / span
        lon = coords[j - 1][0] + t * (coords[j][0] - coords[j - 1][0])
        lat = coords[j - 1][1] + t * (coords[j][1] - coords[j - 1][1])
        out.append((lon, lat))
    return out


def _jitter(
    rng: np.random.Generator, lat: float, lon: float, sigma_m: float = GPS_NOISE_M
) -> tuple[float, float]:
    north, east = rng.normal(0.0, sigma_m, size=2)
    return _offset_m(lat, lon, float(north), float(east))


def _itinerary_for(path: list[tuple[float, float]]) -> ItineraryIn:
    start = path[0]
    end = path[-1]
    return ItineraryIn(
        coordinates=path,
        corridor_m=2000,
        waypoints=[
            WaypointIn(name="start", lat=start[1], lon=start[0], dwell_minutes=20),
            WaypointIn(name="end", lat=end[1], lon=end[0], dwell_minutes=30),
        ],
    )


def _base_times(start: datetime, n: int, interval_s: float) -> list[datetime]:
    return [start + timedelta(seconds=interval_s * i) for i in range(n)]


def generate_window(
    rng: np.random.Generator,
    *,
    window_id: str,
    scenario: str,
    label: int,
    start: datetime,
    n_pings: int = 48,
    interval_s: float = 5.0,
) -> SyntheticWindow:
    path = NH6 if scenario != "normal-trek" or rng.random() > 0.3 else KAZIRANGA
    if scenario == "normal-trek" and rng.random() > 0.5:
        path = KAZIRANGA
    itinerary = _itinerary_for(path)
    speed = WALK_MPS if path is KAZIRANGA else CAR_MPS
    pts = _interpolate_path(path, n_pings)
    times = _base_times(start, n_pings, interval_s)
    zones: list[ZoneIn] = [ACCOMMODATION_ZONE]

    if scenario == "stationary-anomaly":
        # 02:00 IST motionless on the highway — not an accommodation.
        start = datetime(2025, 10, 12, 2, 0, tzinfo=IST)
        times = _base_times(start, n_pings, 60.0)
        anchor = path[len(path) // 2]
        pts = [anchor] * n_pings
        speed = 0.05
    elif scenario == "signal-loss":
        # One 25-minute hole in the middle of an otherwise normal trace.
        mid = n_pings // 2
        times = (
            _base_times(start, mid, interval_s)
            + _base_times(
                start + timedelta(seconds=interval_s * mid + 25 * 60),
                n_pings - mid,
                interval_s,
            )
        )
    elif scenario == "route-deviation":
        shifted: list[tuple[float, float]] = []
        for i, (lon, lat) in enumerate(pts):
            t = i / max(n_pings - 1, 1)
            lat2, lon2 = _offset_m(lat, lon, 3000.0 * t, 0.0)
            shifted.append((lon2, lat2))
        pts = shifted
    elif scenario == "zone-breach":
        zones = [RESTRICTED_ZONE, ACCOMMODATION_ZONE]
        # Last third of the window is planted inside the restricted polygon.
        breach_pt = (91.93, 25.65)
        cut = (2 * n_pings) // 3
        pts = pts[:cut] + [breach_pt] * (n_pings - cut)
        times = _base_times(start, n_pings, interval_s)
    elif scenario == "panic-sos":
        # Erratic heading / speed spikes — SOS itself is a device event, not ML.
        speed = CAR_MPS

    pings: list[PingIn] = []
    battery = 86.0
    prev_lat, prev_lon = pts[0][1], pts[0][0]
    for i, ((lon, lat), ts) in enumerate(zip(pts, times)):
        jlat, jlon = _jitter(rng, lat, lon)
        if scenario == "panic-sos":
            jlat, jlon = _jitter(rng, lat, lon, sigma_m=35.0)
            inst_speed = abs(float(rng.normal(speed, 8.0)))
        elif scenario == "stationary-anomaly":
            inst_speed = abs(float(rng.normal(0.05, 0.04)))
        else:
            inst_speed = max(0.0, float(rng.normal(speed, speed * 0.12)))
        head = bearing(prev_lat, prev_lon, jlat, jlon)
        if scenario == "panic-sos":
            head = float(rng.uniform(0, 360))
        dt_h = interval_s / 3600.0
        battery = max(5.0, battery - dt_h * float(rng.uniform(4.0, 8.0)))
        pings.append(
            PingIn(
                lat=jlat,
                lon=jlon,
                recorded_at=ts,
                speed_mps=inst_speed,
                heading_deg=head,
                battery_pct=round(battery, 3),
                accuracy_m=8.0,
            )
        )
        prev_lat, prev_lon = jlat, jlon

    return SyntheticWindow(
        window_id=window_id,
        label=label,
        scenario=scenario,
        pings=pings,
        itinerary=itinerary,
        zones=zones,
    )


def generate_dataset(
    n_normal: int = 5000,
    n_anomalous: int = 500,
    seed: int = 42,
) -> list[SyntheticWindow]:
    rng = np.random.default_rng(seed)
    anomalous_scenarios = [
        "zone-breach",
        "signal-loss",
        "route-deviation",
        "panic-sos",
        "stationary-anomaly",
    ]
    per = n_anomalous // len(anomalous_scenarios)
    extra = n_anomalous - per * len(anomalous_scenarios)
    windows: list[SyntheticWindow] = []
    day0 = datetime(2025, 10, 12, 9, 0, tzinfo=IST)
    for i in range(n_normal):
        start = day0 + timedelta(minutes=int(rng.integers(0, 8 * 60)))
        windows.append(
            generate_window(
                rng,
                window_id=f"n{i:04d}",
                scenario="normal-trek",
                label=0,
                start=start,
            )
        )
    k = 0
    for s_i, scenario in enumerate(anomalous_scenarios):
        count = per + (1 if s_i < extra else 0)
        for _ in range(count):
            if scenario == "stationary-anomaly":
                start = datetime(2025, 10, 12, 2, 0, tzinfo=IST)
            else:
                start = day0 + timedelta(minutes=int(rng.integers(0, 8 * 60)))
            windows.append(
                generate_window(
                    rng,
                    window_id=f"a{k:04d}",
                    scenario=scenario,
                    label=1,
                    start=start,
                )
            )
            k += 1
    return windows


def windows_from_phase10(
    csv_path: Path = PHASE10_CSV, labels_path: Path = PHASE10_LABELS
) -> list[SyntheticWindow] | None:
    if not csv_path.exists():
        return None
    df = pd.read_csv(csv_path)
    required = {"window_id", "lat", "lon", "recorded_at"}
    if not required.issubset(df.columns):
        raise ValueError(
            f"{csv_path} missing columns {required - set(df.columns)}; "
            "expected Phase 10 schema documented in app/synthetic.py"
        )
    label_map: dict[str, tuple[int, str]] = {}
    if labels_path.exists():
        raw = json.loads(labels_path.read_text(encoding="utf-8"))
        if isinstance(raw, dict) and "windows" in raw:
            for row in raw["windows"]:
                label_map[str(row["window_id"])] = (
                    int(row["label"]),
                    str(row.get("scenario", "unknown")),
                )
        elif isinstance(raw, dict):
            for wid, val in raw.items():
                if isinstance(val, dict):
                    label_map[str(wid)] = (int(val["label"]), str(val.get("scenario", "unknown")))
                else:
                    label_map[str(wid)] = (int(val), "unknown")

    windows: list[SyntheticWindow] = []
    for window_id, group in df.groupby("window_id", sort=True):
        group = group.sort_values("seq" if "seq" in group.columns else "recorded_at")
        label = 0
        scenario = "normal-trek"
        if "label" in group.columns:
            label = int(group["label"].iloc[0])
        if "scenario" in group.columns:
            scenario = str(group["scenario"].iloc[0])
        if str(window_id) in label_map:
            label, scenario = label_map[str(window_id)]
        pings: list[PingIn] = []
        for _, row in group.iterrows():
            ts = pd.Timestamp(row["recorded_at"])
            if ts.tzinfo is None:
                ts = ts.tz_localize("UTC")
            pings.append(
                PingIn(
                    lat=float(row["lat"]),
                    lon=float(row["lon"]),
                    recorded_at=ts.to_pydatetime(),
                    speed_mps=_opt_float(row, "speed_mps"),
                    heading_deg=_opt_float(row, "heading_deg"),
                    battery_pct=_opt_int(row, "battery_pct"),
                    accuracy_m=_opt_float(row, "accuracy_m"),
                )
            )
        path = [(p.lon, p.lat) for p in pings]
        if len(path) < 2:
            path = path + path
        windows.append(
            SyntheticWindow(
                window_id=str(window_id),
                label=label,
                scenario=scenario,
                pings=pings,
                itinerary=_itinerary_for(path[: max(2, min(8, len(path)))]),
                zones=[ACCOMMODATION_ZONE, RESTRICTED_ZONE],
            )
        )
    return windows


def _opt_float(row: pd.Series, col: str) -> float | None:
    if col not in row.index or pd.isna(row[col]):
        return None
    return float(row[col])


def _opt_int(row: pd.Series, col: str) -> int | None:
    if col not in row.index or pd.isna(row[col]):
        return None
    return int(row[col])


def load_or_generate(
    n_normal: int = 5000, n_anomalous: int = 500, seed: int = 42
) -> tuple[list[SyntheticWindow], str]:
    loaded = windows_from_phase10()
    if loaded:
        return loaded, str(PHASE10_CSV)
    return generate_dataset(n_normal, n_anomalous, seed), "synthetic:app.synthetic"


def iter_feature_rows(windows: list[SyntheticWindow]) -> Iterator[SyntheticWindow]:
    yield from windows
