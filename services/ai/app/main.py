# services/ai/app/main.py
"""FastAPI scoring service for Hugging Face Spaces (port 7860)."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import (
    ARTIFACTS_DIR,
    CONTAMINATION,
    METRICS_PATH,
    MODEL_META_PATH,
    MODEL_VERSION,
    N_FEATURES,
    anomaly_threshold,
    app_url,
    log_level,
)
from app.features import FEATURE_NAMES, extract_features
from app.models.isolation_forest import IForestModel, load_model
from app.models.safety_score import compute_safety_breakdown
from app.schemas import (
    BatchScoreRequest,
    HealthResponse,
    ModelInfoResponse,
    ScoreRequest,
    ScoreResponse,
    StopOut,
)

_MODEL: IForestModel | None = None
_METRICS: dict[str, Any] | None = None


def _load_metrics() -> dict[str, Any] | None:
    import json

    for path in (METRICS_PATH, MODEL_META_PATH):
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    return None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _MODEL, _METRICS
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    _MODEL = load_model()
    _METRICS = _load_metrics()
    yield
    _MODEL = None


def _cors_origins() -> list[str]:
    url = app_url()
    origins = [
        url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    return list(dict.fromkeys(origins))


app = FastAPI(
    title="Tourist Safety Scoring",
    version=MODEL_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=r"https://(.*\.vercel\.app|.*\.hf\.space)",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def get_model() -> IForestModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = load_model()
    return _MODEL


def score_window(body: ScoreRequest) -> ScoreResponse:
    features = extract_features(body.pings, body.itinerary, body.zones)
    model = get_model()
    pred = model.predict(features.as_array().reshape(1, -1))
    anomaly_score = float(pred.anomaly_score[0])
    is_anomaly = bool(pred.is_anomaly[0])
    last_ping = max(body.pings, key=lambda p: p.recorded_at)
    breakdown = compute_safety_breakdown(features, body, anomaly_score, last_ping)
    return ScoreResponse(
        anomaly_score=anomaly_score,
        is_anomaly=is_anomaly,
        safety_score=breakdown.score,
        factors=list(breakdown.factors),
        model_version=MODEL_VERSION,
        features=[float(v) for v in features.vector],
        stops=[
            StopOut(
                centroid_lat=s.centroid_lat,
                centroid_lon=s.centroid_lon,
                duration_s=s.duration_s,
                n_pings=s.n_pings,
                kind=s.kind,
            )
            for s in features.stops.stops
        ],
    )


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "service": "tourist-safety-ai",
        "docs": "/docs",
        "health": "/health",
        "model": "/model/info",
    }


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    model = get_model()
    ready = model.sklearn_ready or model.onnx_ready
    return HealthResponse(
        status="ok" if ready else "degraded",
        model_version=MODEL_VERSION,
        sklearn_loaded=model.sklearn_ready,
        onnx_loaded=model.onnx_ready,
        n_features=N_FEATURES,
    )


@app.get("/model/info", response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    metrics = _METRICS
    slim: dict[str, float | int | str] | None = None
    if isinstance(metrics, dict):
        holdout = metrics.get("holdout") if "holdout" in metrics else metrics
        if isinstance(holdout, dict):
            slim = {}
            for key in (
                "precision",
                "recall",
                "f1",
                "support",
                "threshold",
                "n_train",
                "n_test",
            ):
                val = holdout.get(key, metrics.get(key))
                if isinstance(val, (int, float, str)):
                    slim[key] = val
    return ModelInfoResponse(
        model_version=MODEL_VERSION,
        algorithm="IsolationForest",
        contamination=CONTAMINATION,
        n_features=N_FEATURES,
        feature_names=list(FEATURE_NAMES),
        anomaly_threshold=anomaly_threshold(),
        metrics=slim,
    )


@app.post("/score", response_model=ScoreResponse)
def score(body: ScoreRequest) -> ScoreResponse:
    try:
        return score_window(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/score/batch", response_model=list[ScoreResponse])
def score_batch(body: BatchScoreRequest) -> list[ScoreResponse]:
    return [score_window(window) for window in body.windows]


# Uvicorn / HF Spaces bind this module: `uvicorn app.main:app --port 7860`
_ = log_level
