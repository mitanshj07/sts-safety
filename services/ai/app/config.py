# services/ai/app/config.py
"""Runtime config. Only env vars that already exist in `.env.example`."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ROOT / "artifacts"

MODEL_VERSION = "iforest-v1.0.0"
CONTAMINATION = 0.05
N_ESTIMATORS = 100
RANDOM_STATE = 42
N_FEATURES = 18

STOP_EPS_M = 50.0
STOP_MIN_SAMPLES = 3
STOP_MAX_SPEED_MPS = 1.5
WAYPOINT_MATCH_M = 150.0
ANOMALOUS_STOP_S = 15.0 * 60.0

# Mirrors packages/shared/src/constants/scoring-weights.ts
SCORE_NIGHT_START_HOUR_IST = 22
SCORE_NIGHT_END_HOUR_IST = 5
DEFAULT_CORRIDOR_M = 2000

DEFAULT_ANOMALY_THRESHOLD = 0.72
DEFAULT_APP_URL = "http://localhost:3000"


def _env(name: str, default: str) -> str:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip()


def anomaly_threshold() -> float:
    return float(_env("ANOMALY_THRESHOLD", str(DEFAULT_ANOMALY_THRESHOLD)))


def app_url() -> str:
    return _env("NEXT_PUBLIC_APP_URL", DEFAULT_APP_URL).rstrip("/")


def onnx_model_path() -> Path:
    return Path(_env("ONNX_MODEL_PATH", str(ARTIFACTS_DIR / "iforest.onnx")))


def log_level() -> str:
    return _env("LOG_LEVEL", "info").lower()


SKLEARN_MODEL_PATH = ARTIFACTS_DIR / "iforest.pkl"
SCALER_JSON_PATH = ARTIFACTS_DIR / "scaler.json"
FEATURE_NAMES_PATH = ARTIFACTS_DIR / "feature_names.json"
MODEL_META_PATH = ARTIFACTS_DIR / "model_meta.json"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"
