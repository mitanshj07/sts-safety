# services/ai/tests/test_score.py
"""Golden-vector tests: feature determinism and sklearn ↔ ONNX agreement."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import ARTIFACTS_DIR, MODEL_VERSION, N_FEATURES, SCALER_JSON_PATH
from app.features import FEATURE_NAMES, extract_features
from app.models.isolation_forest import apply_scaler_json, load_model
from app.models.stop_detection import detect_stops
from app.schemas import ItineraryIn, PingIn, WaypointIn, ZoneIn

ROOT = Path(__file__).resolve().parents[1]
GOLDEN = ROOT / "tests" / "golden_vector.json"
TS_FEATURE_VECTOR = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared"
    / "src"
    / "constants"
    / "feature-vector.ts"
)
IST = timezone(timedelta(hours=5, minutes=30))


def _ping(
    lat: float,
    lon: float,
    at: datetime,
    speed: float = 1.0,
    heading: float = 0.0,
    battery: int = 80,
) -> PingIn:
    return PingIn(
        lat=lat,
        lon=lon,
        recorded_at=at,
        speed_mps=speed,
        heading_deg=heading,
        battery_pct=battery,
        accuracy_m=8.0,
    )


def test_feature_count_and_ts_mirror() -> None:
    assert len(FEATURE_NAMES) == N_FEATURES == 18
    text = TS_FEATURE_VECTOR.read_text(encoding="utf-8")
    names = re.findall(r'"([a-z0-9_]+)"', text)
    # The TS file also quotes type-side strings; keep the 18-length const order.
    const_block = text.split("export const FEATURE_NAMES")[1].split("] as const")[0]
    ts_names = re.findall(r'"([a-z0-9_]+)"', const_block)
    assert tuple(ts_names) == FEATURE_NAMES


def test_extract_features_deterministic() -> None:
    start = datetime(2025, 10, 12, 10, 0, tzinfo=IST)
    pings = [
        _ping(26.1445, 91.7362, start + timedelta(seconds=5 * i), speed=11.0, heading=180.0)
        for i in range(12)
    ]
    # March south ~50 m per ping so distance features are non-zero.
    shifted: list[PingIn] = []
    for i, p in enumerate(pings):
        lat = 26.1445 - i * 0.00045
        shifted.append(
            _ping(lat, 91.7362, p.recorded_at, speed=11.0, heading=180.0, battery=90 - i)
        )
    itinerary = ItineraryIn(
        coordinates=[(91.7362, 26.1445), (91.7362, 26.1300)],
        corridor_m=2000,
    )
    a = extract_features(shifted, itinerary, [])
    b = extract_features(shifted, itinerary, [])
    np.testing.assert_allclose(a.as_array(), b.as_array(), atol=1e-12)
    assert a.vector[-1] == 12.0
    assert a.as_dict()["speed_mean_mps"] == pytest.approx(11.0)
    assert a.as_dict()["window_duration_s"] == pytest.approx(55.0)
    assert 0.0 <= a.as_dict()["straightness_index"] <= 1.0
    assert a.as_dict()["night_fraction"] == 0.0


def test_stop_detection_accommodation_vs_roadside() -> None:
    hotel = ZoneIn(
        name="hotel",
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
    start = datetime(2025, 10, 12, 21, 0, tzinfo=IST)
    hotel_pings = [
        _ping(25.577, 91.880, start + timedelta(seconds=30 * i), speed=0.1)
        for i in range(20)
    ]
    hotel_stops = detect_stops(
        hotel_pings,
        zones=[hotel],
        waypoints=[WaypointIn(name="hotel", lat=25.577, lon=91.880, dwell_minutes=40)],
    )
    assert hotel_stops.in_accommodation is True
    assert hotel_stops.has_anomalous_roadside is False

    night = datetime(2025, 10, 12, 2, 0, tzinfo=IST)
    road_pings = [
        _ping(26.05, 91.78, night + timedelta(seconds=60 * i), speed=0.05)
        for i in range(20)
    ]
    road_stops = detect_stops(
        road_pings,
        zones=[],
        waypoints=[],
        itinerary_distance_m=4000.0,
        corridor_m=2000.0,
    )
    assert road_stops.has_anomalous_roadside is True
    assert road_stops.in_accommodation is False


@pytest.mark.skipif(not GOLDEN.exists(), reason="run python -m app.train first")
def test_golden_vector_matches_extractor() -> None:
    payload = json.loads(GOLDEN.read_text(encoding="utf-8"))
    assert payload["feature_names"] == list(FEATURE_NAMES)
    pings = [
        PingIn(
            lat=p["lat"],
            lon=p["lon"],
            recorded_at=datetime.fromisoformat(p["recorded_at"]),
            speed_mps=p.get("speed_mps"),
            heading_deg=p.get("heading_deg"),
            battery_pct=p.get("battery_pct"),
            accuracy_m=p.get("accuracy_m"),
        )
        for p in payload["pings"]
    ]
    itinerary = ItineraryIn(
        coordinates=[(c[0], c[1]) for c in payload["itinerary"]["coordinates"]],
        corridor_m=payload["itinerary"]["corridor_m"],
        waypoints=[WaypointIn(**w) for w in payload["itinerary"]["waypoints"]],
    )
    zones = [ZoneIn(**z) for z in payload["zones"]]
    got = extract_features(pings, itinerary, zones).as_array()
    expected = np.asarray(payload["features"], dtype=np.float64)
    np.testing.assert_allclose(got, expected, atol=1e-7, rtol=1e-7)


@pytest.mark.skipif(
    not (ARTIFACTS_DIR / "iforest.onnx").exists() or not SCALER_JSON_PATH.exists(),
    reason="run python -m app.train first",
)
def test_sklearn_and_onnx_agree_within_1e_5() -> None:
    model = load_model()
    assert model.sklearn_ready and model.onnx_ready
    rows = []
    if GOLDEN.exists():
        rows.append(
            np.asarray(
                json.loads(GOLDEN.read_text(encoding="utf-8"))["features"],
                dtype=np.float64,
            )
        )
    from app.synthetic import generate_window

    rng = np.random.default_rng(0)
    start = datetime(2025, 10, 12, 10, 0, tzinfo=IST)
    for i, scenario in enumerate(("normal-trek", "stationary-anomaly", "zone-breach")):
        window = generate_window(
            rng,
            window_id=f"t{i}",
            scenario=scenario,
            label=0 if scenario == "normal-trek" else 1,
            start=start,
        )
        rows.append(
            extract_features(window.pings, window.itinerary, window.zones).as_array()
        )
    x = np.vstack(rows)
    sk = model.predict_sklearn(x)
    onx = model.predict_onnx(x)
    np.testing.assert_allclose(sk.decision, onx.decision, atol=1e-5, rtol=1e-5)
    np.testing.assert_allclose(
        sk.anomaly_score, onx.anomaly_score, atol=1e-5, rtol=1e-5
    )


@pytest.mark.skipif(
    not SCALER_JSON_PATH.exists() or not GOLDEN.exists(),
    reason="run python -m app.train first",
)
def test_scaler_json_matches_sklearn() -> None:
    model = load_model()
    assert model.pipeline is not None and model.scaler_spec is not None
    x = np.asarray(
        json.loads(GOLDEN.read_text(encoding="utf-8"))["features"],
        dtype=np.float64,
    ).reshape(1, -1)
    sklearn_scaled = model.pipeline.named_steps["scaler"].transform(x)
    json_scaled = apply_scaler_json(x, model.scaler_spec)
    np.testing.assert_allclose(sklearn_scaled, json_scaled, atol=1e-12)


def test_health_and_score_endpoints() -> None:
    from app.main import app

    start = datetime(2025, 10, 12, 10, 0, tzinfo=IST)
    pings = [
        {
            "lat": 26.1445 - i * 0.0004,
            "lon": 91.7362,
            "recorded_at": (start + timedelta(seconds=5 * i)).isoformat(),
            "speed_mps": 11.0,
            "heading_deg": 180.0,
            "battery_pct": 80,
        }
        for i in range(8)
    ]
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        body = health.json()
        assert body["n_features"] == 18
        assert body["model_version"] == MODEL_VERSION

        info = client.get("/model/info")
        assert info.status_code == 200
        assert info.json()["feature_names"] == list(FEATURE_NAMES)

        scored = client.post(
            "/score",
            json={
                "pings": pings,
                "itinerary": {
                    "coordinates": [[91.7362, 26.1445], [91.7362, 26.12]],
                    "corridor_m": 2000,
                    "waypoints": [],
                },
                "zones": [],
                "open_high_incidents": 0,
            },
        )
        assert scored.status_code == 200, scored.text
        payload = scored.json()
        assert 0.0 <= payload["anomaly_score"] <= 1.0
        assert 0 <= payload["safety_score"] <= 100
        assert len(payload["features"]) == 18
        assert {f["name"] for f in payload["factors"]} == {
            "zone_risk",
            "itinerary_deviation",
            "ping_silence",
            "open_high_incidents",
            "ml_anomaly",
            "night_non_accommodation",
        }
        batch = client.post("/score/batch", json={"windows": [{"pings": pings}]})
        assert batch.status_code == 200
        assert len(batch.json()) == 1
