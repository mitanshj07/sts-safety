# services/ai/app/schemas.py
"""Pydantic v2 request/response models for the scoring API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

RiskLevel = Literal["none", "low", "medium", "high", "critical"]
ZoneCategory = Literal[
    "safe",
    "caution",
    "restricted",
    "high_risk",
    "border",
    "forest_reserve",
    "accommodation",
    "checkpoint",
    "medical",
]
StopKind = Literal[
    "pause",
    "waypoint",
    "accommodation",
    "roadside",
    "anomalous_roadside",
]


class PingIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    recorded_at: datetime
    speed_mps: float | None = Field(default=None, ge=0)
    heading_deg: float | None = Field(default=None, ge=0, le=360)
    battery_pct: float | None = Field(default=None, ge=0, le=100)
    accuracy_m: float | None = Field(default=None, gt=0)

    @field_validator("recorded_at")
    @classmethod
    def _require_tz(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("recorded_at must be timezone-aware")
        return value


class WaypointIn(BaseModel):
    name: str = "waypoint"
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    dwell_minutes: int | None = Field(default=None, ge=0)


class ItineraryIn(BaseModel):
    """LineString coordinates are GeoJSON order: [lon, lat]."""

    coordinates: list[tuple[float, float]] = Field(default_factory=list, min_length=0)
    corridor_m: int = Field(default=2000, gt=0)
    waypoints: list[WaypointIn] = Field(default_factory=list)


class ZoneIn(BaseModel):
    name: str = "zone"
    category: ZoneCategory = "safe"
    risk_level: RiskLevel = "none"
    geom: list[list[tuple[float, float]]] | None = None


class ScoreRequest(BaseModel):
    pings: list[PingIn] = Field(..., min_length=1, max_length=4000)
    itinerary: ItineraryIn | None = None
    zones: list[ZoneIn] = Field(default_factory=list)
    open_high_incidents: int = Field(default=0, ge=0)


class BatchScoreRequest(BaseModel):
    windows: list[ScoreRequest] = Field(..., min_length=1, max_length=32)


class ScoreFactor(BaseModel):
    name: str
    contribution: float
    detail: str


class StopOut(BaseModel):
    centroid_lat: float
    centroid_lon: float
    duration_s: float
    n_pings: int
    kind: StopKind


class ScoreResponse(BaseModel):
    anomaly_score: float = Field(..., ge=0, le=1)
    is_anomaly: bool
    safety_score: int = Field(..., ge=0, le=100)
    factors: list[ScoreFactor]
    model_version: str
    features: list[float]
    stops: list[StopOut] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_version: str
    sklearn_loaded: bool
    onnx_loaded: bool
    n_features: int


class ModelInfoResponse(BaseModel):
    model_version: str
    algorithm: str
    contamination: float
    n_features: int
    feature_names: list[str]
    anomaly_threshold: float
    metrics: dict[str, float | int | str] | None = None
