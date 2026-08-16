# services/ai/app/models/safety_score.py
"""Composite 0–100 safety score with a per-factor contribution breakdown.

Mirrors `app.compute_safety_score()` / `packages/shared/src/constants/scoring-weights.ts`
so the UI explanation matches Postgres. Extra window context (stop type) is folded
into the existing night and deviation factors rather than inventing a parallel formula.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import DEFAULT_CORRIDOR_M, SCORE_NIGHT_END_HOUR_IST, SCORE_NIGHT_START_HOUR_IST
from app.features import FEATURE_INDEX, WindowFeatures
from app.models.stop_detection import is_score_night
from app.schemas import PingIn, ScoreFactor, ScoreRequest

SAFETY_SCORE_START = 100
SAFETY_SCORE_MIN = 0
SAFETY_SCORE_MAX = 100

ZONE_RISK_PENALTY = {
    "none": 0,
    "low": 4,
    "medium": 12,
    "high": 25,
    "critical": 40,
}

DEVIATION_STEP_M = 500
DEVIATION_STEP_PENALTY = 5
DEVIATION_MAX_PENALTY = 20

SILENCE_GRACE_MINUTES = 15
SILENCE_STEP_MINUTES = 5
SILENCE_STEP_PENALTY = 5
SILENCE_MAX_PENALTY = 25

OPEN_HIGH_INCIDENT_PENALTY = 15
OPEN_HIGH_INCIDENT_MAX_PENALTY = 30

ANOMALY_PENALTY_SCALE = 20
NIGHT_NON_ACCOMMODATION_PENALTY = 5

RISK_FROM_WEIGHT = (
    (0.875, "critical"),
    (0.625, "high"),
    (0.375, "medium"),
    (0.125, "low"),
    (0.0, "none"),
)


def _trunc_div(numerator: float, denominator: float) -> int:
    return int(numerator // denominator)


def _risk_from_dwell(weight: float) -> str:
    for threshold, name in RISK_FROM_WEIGHT:
        if weight >= threshold:
            return name
    return "none"


@dataclass(frozen=True)
class SafetyBreakdown:
    score: int
    factors: tuple[ScoreFactor, ...]


def compute_safety_breakdown(
    features: WindowFeatures,
    request: ScoreRequest,
    anomaly_score: float,
    last_ping: PingIn,
) -> SafetyBreakdown:
    vector = features.vector
    zone_weight = vector[FEATURE_INDEX["zone_risk_weighted_dwell"]]
    risk_name = _risk_from_dwell(zone_weight)
    # Prefer the last ping's actual containing zone when geometry was provided.
    last_risk = risk_name
    if request.zones:
        from app.geo import point_in_polygon

        best_rank = -1
        rank = {"none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
        for zone in request.zones:
            if zone.geom and point_in_polygon(last_ping.lat, last_ping.lon, zone.geom):
                r = rank.get(zone.risk_level, 0)
                if r > best_rank:
                    best_rank = r
                    last_risk = zone.risk_level
        if best_rank < 0:
            last_risk = risk_name

    zone_penalty = ZONE_RISK_PENALTY.get(last_risk, 0)

    itinerary_distance_m = vector[FEATURE_INDEX["itinerary_distance_m"]]
    corridor_m = (
        float(request.itinerary.corridor_m)
        if request.itinerary is not None
        else float(DEFAULT_CORRIDOR_M)
    )
    deviation_m = max(0.0, itinerary_distance_m - corridor_m)
    if deviation_m > 0:
        deviation_penalty = min(
            DEVIATION_MAX_PENALTY,
            _trunc_div(deviation_m, DEVIATION_STEP_M) * DEVIATION_STEP_PENALTY,
        )
    else:
        deviation_penalty = 0

    gap_max_s = vector[FEATURE_INDEX["ping_gap_max_s"]]
    silence_minutes = gap_max_s / 60.0
    if silence_minutes > SILENCE_GRACE_MINUTES:
        silence_penalty = min(
            SILENCE_MAX_PENALTY,
            _trunc_div(silence_minutes - SILENCE_GRACE_MINUTES, SILENCE_STEP_MINUTES)
            * SILENCE_STEP_PENALTY,
        )
    else:
        silence_penalty = 0

    open_high = request.open_high_incidents
    incident_penalty = min(
        OPEN_HIGH_INCIDENT_MAX_PENALTY, open_high * OPEN_HIGH_INCIDENT_PENALTY
    )

    anomaly_penalty = int(anomaly_score * ANOMALY_PENALTY_SCALE)

    in_accommodation = features.stops.in_accommodation
    if request.zones:
        from app.geo import point_in_polygon

        in_accommodation = in_accommodation or any(
            z.category == "accommodation"
            and z.geom is not None
            and point_in_polygon(last_ping.lat, last_ping.lon, z.geom)
            for z in request.zones
        )
    night = is_score_night(last_ping.recorded_at)
    night_penalty = (
        NIGHT_NON_ACCOMMODATION_PENALTY if night and not in_accommodation else 0
    )

    factors = (
        ScoreFactor(
            name="zone_risk",
            contribution=-float(zone_penalty),
            detail=f"max zone risk '{last_risk}' (weight {zone_weight:.2f})",
        ),
        ScoreFactor(
            name="itinerary_deviation",
            contribution=-float(deviation_penalty),
            detail=f"{deviation_m:.0f} m outside {corridor_m:.0f} m corridor",
        ),
        ScoreFactor(
            name="ping_silence",
            contribution=-float(silence_penalty),
            detail=f"max ping gap {silence_minutes:.1f} min",
        ),
        ScoreFactor(
            name="open_high_incidents",
            contribution=-float(incident_penalty),
            detail=f"{open_high} open high/critical incidents",
        ),
        ScoreFactor(
            name="ml_anomaly",
            contribution=-float(anomaly_penalty),
            detail=f"anomaly_score {anomaly_score:.3f} × {ANOMALY_PENALTY_SCALE}",
        ),
        ScoreFactor(
            name="night_non_accommodation",
            contribution=-float(night_penalty),
            detail=(
                f"IST night ({SCORE_NIGHT_START_HOUR_IST}:00–{SCORE_NIGHT_END_HOUR_IST}:00) "
                f"in_accommodation={in_accommodation}"
            ),
        ),
    )

    raw = SAFETY_SCORE_START + sum(int(f.contribution) for f in factors)
    score = max(SAFETY_SCORE_MIN, min(SAFETY_SCORE_MAX, raw))
    return SafetyBreakdown(score=score, factors=factors)
