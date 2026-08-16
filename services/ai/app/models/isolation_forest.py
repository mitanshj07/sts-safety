# services/ai/app/models/isolation_forest.py
"""IsolationForest (contamination=0.05) + StandardScaler, sklearn and ONNX paths."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.config import (
    ARTIFACTS_DIR,
    CONTAMINATION,
    MODEL_META_PATH,
    MODEL_VERSION,
    N_ESTIMATORS,
    N_FEATURES,
    RANDOM_STATE,
    SCALER_JSON_PATH,
    SKLEARN_MODEL_PATH,
    anomaly_threshold,
    onnx_model_path,
)
from app.features import FEATURE_NAMES

try:
    import onnxruntime as ort
except ImportError:  # pragma: no cover - optional at runtime on a slim image
    ort = None  # type: ignore[assignment]


SCORE_INLIER = 0.2  # typical inlier target when decision == +score_scale


def decision_to_unit(
    decision: np.ndarray,
    *,
    threshold: float,
    scale: float,
) -> np.ndarray:
    """Affine map: decision==0 → threshold (ANOMALY_THRESHOLD), +scale → SCORE_INLIER.

    IsolationForest's contamination cutoff is decision_function == 0, so
    `anomaly_score >= ANOMALY_THRESHOLD` matches the native predict()== -1 rule.
    """
    safe_scale = max(float(scale), 1e-6)
    mapped = threshold - decision * (threshold - SCORE_INLIER) / safe_scale
    return np.clip(mapped, 0.0, 1.0)


def scaler_to_json(scaler: StandardScaler) -> dict[str, Any]:
    mean = scaler.mean_.astype(np.float64).tolist()
    scale = scaler.scale_.astype(np.float64).tolist()
    return {
        "mean": mean,
        "scale": scale,
        "var": scaler.var_.astype(np.float64).tolist() if scaler.var_ is not None else None,
        "n_features": int(scaler.n_features_in_),
        "feature_names": list(FEATURE_NAMES),
        "with_mean": bool(scaler.with_mean),
        "with_std": bool(scaler.with_std),
        "included_in_onnx": False,
        "note": "Apply (x - mean) / scale before feeding iforest.onnx.",
        "score_inlier": SCORE_INLIER,
    }


def apply_scaler_json(x: np.ndarray, spec: dict[str, Any]) -> np.ndarray:
    mean = np.asarray(spec["mean"], dtype=np.float64)
    scale = np.asarray(spec["scale"], dtype=np.float64)
    # Match sklearn.preprocessing._data._handle_zeros_in_scale (exact zeros only).
    scale = np.where(scale == 0.0, 1.0, scale)
    return (x.astype(np.float64) - mean) / scale


@dataclass
class AnomalyPrediction:
    anomaly_score: np.ndarray
    is_anomaly: np.ndarray
    decision: np.ndarray
    backend: str


class IForestModel:
    def __init__(
        self,
        pipeline: Pipeline | None = None,
        scaler_spec: dict[str, Any] | None = None,
        onnx_session: Any | None = None,
        onnx_input_name: str = "features",
        onnx_decision_index: int = 1,
        onnx_kind: str = "decision_function",
        onnx_offset: float = 0.0,
        onnx_output_index: int = 1,
        onnx_output_column: int | None = None,
        score_scale: float = 0.25,
    ) -> None:
        self.pipeline = pipeline
        self.scaler_spec = scaler_spec
        self.onnx_session = onnx_session
        self.onnx_input_name = onnx_input_name
        self.onnx_decision_index = onnx_decision_index
        self.onnx_kind = onnx_kind
        self.onnx_offset = onnx_offset
        self.onnx_output_index = onnx_output_index
        self.onnx_output_column = onnx_output_column
        self.score_scale = score_scale

    @property
    def sklearn_ready(self) -> bool:
        return self.pipeline is not None

    @property
    def onnx_ready(self) -> bool:
        return self.onnx_session is not None and self.scaler_spec is not None

    def predict_sklearn(self, x: np.ndarray) -> AnomalyPrediction:
        if self.pipeline is None:
            raise RuntimeError("sklearn pipeline is not loaded")
        x2 = np.asarray(x, dtype=np.float64).reshape(-1, N_FEATURES)
        decision = np.asarray(
            self.pipeline.decision_function(x2), dtype=np.float64
        ).reshape(-1)
        scores = decision_to_unit(
            decision, threshold=anomaly_threshold(), scale=self.score_scale
        )
        threshold = anomaly_threshold()
        return AnomalyPrediction(
            anomaly_score=scores,
            is_anomaly=scores >= threshold,
            decision=decision,
            backend="sklearn",
        )

    def predict_onnx(self, x: np.ndarray) -> AnomalyPrediction:
        if self.onnx_session is None or self.scaler_spec is None:
            raise RuntimeError("ONNX session or scaler.json is not loaded")
        x2 = np.asarray(x, dtype=np.float64).reshape(-1, N_FEATURES)
        scaled = apply_scaler_json(x2, self.scaler_spec).astype(np.float32)
        outputs = self.onnx_session.run(
            None, {self.onnx_input_name: scaled}
        )
        raw = self._extract_onnx_raw(outputs, scaled.shape[0])
        if self.onnx_kind == "score_samples":
            decision = raw - self.onnx_offset
        else:
            decision = raw
        scores = decision_to_unit(
            decision, threshold=anomaly_threshold(), scale=self.score_scale
        )
        threshold = anomaly_threshold()
        return AnomalyPrediction(
            anomaly_score=scores,
            is_anomaly=scores >= threshold,
            decision=decision,
            backend="onnx",
        )

    def predict(self, x: np.ndarray) -> AnomalyPrediction:
        if self.sklearn_ready:
            return self.predict_sklearn(x)
        if self.onnx_ready:
            return self.predict_onnx(x)
        x2 = np.asarray(x, dtype=np.float64).reshape(-1, N_FEATURES)
        zeros = np.zeros(x2.shape[0], dtype=np.float64)
        return AnomalyPrediction(
            anomaly_score=zeros,
            is_anomaly=np.zeros(x2.shape[0], dtype=bool),
            decision=zeros,
            backend="rules-only",
        )

    def _extract_onnx_raw(self, outputs: list[Any], n: int) -> np.ndarray:
        idx = min(self.onnx_output_index, len(outputs) - 1)
        arr = np.asarray(outputs[idx], dtype=np.float64)
        if arr.ndim == 2:
            col = self.onnx_output_column
            if col is None:
                col = arr.shape[1] - 1
            return arr[:, col].reshape(-1)
        if arr.ndim == 1 and arr.shape[0] == n:
            return arr.reshape(-1)
        return self._parse_onnx_decision(outputs, n)

    @staticmethod
    def _parse_onnx_decision(outputs: list[Any], n: int) -> np.ndarray:
        """skl2onnx IsolationForest typically emits (label, scores)."""
        for out in outputs:
            arr = np.asarray(out)
            if arr.ndim == 2 and arr.shape[1] >= 1 and arr.shape[0] == n:
                # Some converters emit [inlier_score, outlier_score]; take last col.
                col = arr[:, -1]
                return np.asarray(col, dtype=np.float64).reshape(-1)
            if arr.ndim == 1 and arr.shape[0] == n:
                # Skip integer label vectors.
                if np.issubdtype(arr.dtype, np.integer):
                    continue
                return np.asarray(arr, dtype=np.float64).reshape(-1)
            if arr.ndim == 2 and arr.shape[0] == n and arr.shape[1] == 2:
                return np.asarray(arr[:, 0], dtype=np.float64).reshape(-1)
        raise RuntimeError(
            f"unrecognised IsolationForest ONNX outputs: {[np.asarray(o).shape for o in outputs]}"
        )


def train_iforest(x: np.ndarray) -> Pipeline:
    x2 = np.asarray(x, dtype=np.float64).reshape(-1, N_FEATURES)
    scaler = StandardScaler()
    forest = IsolationForest(
        n_estimators=N_ESTIMATORS,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
        n_jobs=1,
        max_samples="auto",
        bootstrap=False,
    )
    pipe = Pipeline([("scaler", scaler), ("iforest", forest)])
    pipe.fit(x2)
    return pipe


def export_scaler_json(pipeline: Pipeline, path: Path | None = None) -> dict[str, Any]:
    scaler: StandardScaler = pipeline.named_steps["scaler"]
    spec = scaler_to_json(scaler)
    dest = path or SCALER_JSON_PATH
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    return spec


def export_onnx(pipeline: Pipeline, x_sample: np.ndarray, path: Path | None = None) -> Path:
    from skl2onnx import convert_sklearn, to_onnx
    from skl2onnx.common.data_types import FloatTensorType

    dest = path or ARTIFACTS_DIR / "iforest.onnx"
    dest.parent.mkdir(parents=True, exist_ok=True)
    forest: IsolationForest = pipeline.named_steps["iforest"]
    sample = np.asarray(x_sample, dtype=np.float32).reshape(-1, N_FEATURES)
    # IsolationForest alone: the TS fallback applies scaler.json first.
    last_error: Exception | None = None
    for target in (
        15,
        17,
        12,
        {"ai.onnx": 15, "ai.onnx.ml": 3, "": 15},
        {"ai.onnx": 12, "ai.onnx.ml": 3, "": 12},
    ):
        try:
            onx = convert_sklearn(
                forest,
                name="tourist_safety_iforest",
                initial_types=[("features", FloatTensorType([None, N_FEATURES]))],
                target_opset=target,
            )
            dest.write_bytes(onx.SerializeToString())
            return dest
        except Exception as exc:  # noqa: BLE001 — try the next opset
            last_error = exc
    try:
        onx = to_onnx(forest, sample[:1], target_opset=15)
        dest.write_bytes(onx.SerializeToString())
        return dest
    except Exception as exc:  # noqa: BLE001
        last_error = exc
    raise RuntimeError(f"IsolationForest ONNX export failed: {last_error}") from last_error


def save_sklearn(pipeline: Pipeline, path: Path | None = None) -> Path:
    dest = path or SKLEARN_MODEL_PATH
    dest.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, dest)
    return dest


def load_model(
    sklearn_path: Path | None = None,
    onnx_path: Path | None = None,
    scaler_path: Path | None = None,
) -> IForestModel:
    sklearn_path = sklearn_path or SKLEARN_MODEL_PATH
    onnx_path = onnx_path or onnx_model_path()
    scaler_path = scaler_path or SCALER_JSON_PATH

    pipeline: Pipeline | None = None
    if sklearn_path.exists():
        loaded = joblib.load(sklearn_path)
        if not isinstance(loaded, Pipeline):
            raise TypeError(f"expected sklearn Pipeline in {sklearn_path}")
        pipeline = loaded

    scaler_spec: dict[str, Any] | None = None
    if scaler_path.exists():
        scaler_spec = json.loads(scaler_path.read_text(encoding="utf-8"))

    onnx_kind = "decision_function"
    onnx_offset = 0.0
    onnx_output_index = 1
    onnx_output_column: int | None = None
    if MODEL_META_PATH.exists():
        meta = json.loads(MODEL_META_PATH.read_text(encoding="utf-8"))
        onnx_kind = str(meta.get("onnx_kind", onnx_kind))
        onnx_offset = float(meta.get("onnx_offset", onnx_offset))
        onnx_output_index = int(meta.get("onnx_output_index", onnx_output_index))
        col = meta.get("onnx_output_column")
        onnx_output_column = int(col) if col is not None else None
        score_scale = float(meta.get("score_scale", 0.25))
    else:
        score_scale = 0.25
    if scaler_spec and "score_scale" in scaler_spec:
        score_scale = float(scaler_spec["score_scale"])

    session = None
    input_name = "features"
    if ort is not None and onnx_path.exists():
        session = ort.InferenceSession(
            str(onnx_path), providers=["CPUExecutionProvider"]
        )
        input_name = session.get_inputs()[0].name

    return IForestModel(
        pipeline=pipeline,
        scaler_spec=scaler_spec,
        onnx_session=session,
        onnx_input_name=input_name,
        onnx_kind=onnx_kind,
        onnx_offset=onnx_offset,
        onnx_output_index=onnx_output_index,
        onnx_output_column=onnx_output_column,
        score_scale=score_scale,
    )


def model_version() -> str:
    return MODEL_VERSION
