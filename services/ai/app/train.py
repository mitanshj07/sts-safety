# services/ai/app/train.py
"""Train IsolationForest, evaluate against injected labels, export ONNX + scaler.json.

Run from services/ai:

    python -m app.train
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from app.config import (
    ARTIFACTS_DIR,
    CONTAMINATION,
    METRICS_PATH,
    MODEL_META_PATH,
    MODEL_VERSION,
    N_FEATURES,
    RANDOM_STATE,
    SCALER_JSON_PATH,
    anomaly_threshold,
    onnx_model_path,
)
from app.features import FEATURE_NAMES, extract_features
from app.models.isolation_forest import (
    apply_scaler_json,
    decision_to_unit,
    export_onnx,
    export_scaler_json,
    load_model,
    save_sklearn,
    train_iforest,
)
from app.synthetic import SyntheticWindow, load_or_generate

GOLDEN_PATH = Path(__file__).resolve().parents[1] / "tests" / "golden_vector.json"


def _split(
    labels: np.ndarray, seed: int = RANDOM_STATE, test_frac: float = 0.3
) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    idx = np.arange(labels.shape[0])
    test_mask = np.zeros(labels.shape[0], dtype=bool)
    for y in (0, 1):
        members = idx[labels == y]
        rng.shuffle(members)
        n_test = max(1, int(round(members.size * test_frac)))
        test_mask[members[:n_test]] = True
    return np.where(~test_mask)[0], np.where(test_mask)[0]


def extract_matrix(windows: list[SyntheticWindow]) -> tuple[np.ndarray, np.ndarray, list[str]]:
    rows: list[np.ndarray] = []
    labels: list[int] = []
    scenarios: list[str] = []
    for i, window in enumerate(windows):
        feats = extract_features(window.pings, window.itinerary, window.zones)
        rows.append(feats.as_array())
        labels.append(window.label)
        scenarios.append(window.scenario)
        if (i + 1) % 500 == 0:
            print(f"  features {i + 1}/{len(windows)}", flush=True)
    x = np.vstack(rows).astype(np.float64)
    y = np.asarray(labels, dtype=np.int32)
    return x, y, scenarios


def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "support": int(y_true.size),
        "positives": int(y_true.sum()),
        "pred_positives": int(y_pred.sum()),
    }


def _print_table(rows: list[tuple[str, dict[str, float]]]) -> None:
    print()
    print(f"{'scenario':<22} {'precision':>10} {'recall':>10} {'f1':>10} {'support':>8}")
    print("-" * 64)
    for name, m in rows:
        print(
            f"{name:<22} {m['precision']:10.3f} {m['recall']:10.3f} "
            f"{m['f1']:10.3f} {int(m['support']):8d}"
        )
    print()


def _calibrate_onnx(pipeline, scaler_spec: dict, x: np.ndarray) -> dict[str, float | str]:
    import onnxruntime as ort

    session = ort.InferenceSession(
        str(onnx_model_path()), providers=["CPUExecutionProvider"]
    )
    input_name = session.get_inputs()[0].name
    scaled = apply_scaler_json(x, scaler_spec).astype(np.float32)
    outputs = session.run(None, {input_name: scaled})
    sk_decision = np.asarray(pipeline.decision_function(x), dtype=np.float64).reshape(-1)
    forest = pipeline.named_steps["iforest"]
    offset = float(forest.offset_)
    sk_scores = np.asarray(forest.score_samples(scaled.astype(np.float64)), dtype=np.float64)

    best_kind = "decision_function"
    best_offset = 0.0
    best_err = float("inf")
    best_out_i = 1
    best_col: int | None = None

    for out_i, out in enumerate(outputs):
        arr = np.asarray(out, dtype=np.float64)
        cols: list[tuple[int | None, np.ndarray]] = []
        if arr.ndim == 2 and arr.shape[0] == x.shape[0]:
            for col in range(arr.shape[1]):
                cols.append((col, arr[:, col].reshape(-1)))
        elif arr.ndim == 1 and arr.shape[0] == x.shape[0]:
            cols.append((None, arr.reshape(-1)))
        for col, cand in cols:
            for kind, offset_try, err in (
                ("decision_function", 0.0, float(np.max(np.abs(cand - sk_decision)))),
                ("score_samples", 0.0, float(np.max(np.abs(cand - sk_scores)))),
                (
                    "score_samples",
                    offset,
                    float(np.max(np.abs((cand - offset) - sk_decision))),
                ),
            ):
                if err < best_err:
                    best_err = err
                    best_kind = kind
                    best_offset = offset_try
                    best_out_i = out_i
                    best_col = col

    return {
        "onnx_kind": best_kind,
        "onnx_offset": best_offset,
        "onnx_max_abs_err": best_err,
        "onnx_output_index": best_out_i,
        "onnx_output_column": best_col,
        "sklearn_offset": offset,
        "onnx_input_name": input_name,
        "onnx_n_outputs": len(outputs),
        "onnx_output_shapes": [list(np.asarray(o).shape) for o in outputs],
    }


def _write_confusion_png(cm: np.ndarray, dest: Path) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed; skipping confusion-matrix PNG")
        return
    fig, ax = plt.subplots(figsize=(4.2, 3.6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks([0, 1], labels=["pred normal", "pred anomaly"])
    ax.set_yticks([0, 1], labels=["true normal", "true anomaly"])
    for (i, j), val in np.ndenumerate(cm):
        ax.text(j, i, int(val), ha="center", va="center", color="black", fontsize=12)
    ax.set_title("IsolationForest hold-out")
    fig.colorbar(im, ax=ax, fraction=0.046)
    fig.tight_layout()
    dest.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(dest, dpi=140)
    plt.close(fig)


def _write_golden(windows: list[SyntheticWindow], x: np.ndarray) -> None:
    # Deterministic normal window, first in the list.
    sample = next(w for w in windows if w.label == 0)
    idx = windows.index(sample)
    payload = {
        "window_id": sample.window_id,
        "scenario": sample.scenario,
        "feature_names": list(FEATURE_NAMES),
        "features": [float(v) for v in x[idx].tolist()],
        "pings": [
            {
                "lat": p.lat,
                "lon": p.lon,
                "recorded_at": p.recorded_at.isoformat(),
                "speed_mps": p.speed_mps,
                "heading_deg": p.heading_deg,
                "battery_pct": p.battery_pct,
                "accuracy_m": p.accuracy_m,
            }
            for p in sample.pings
        ],
        "itinerary": {
            "coordinates": [list(c) for c in sample.itinerary.coordinates],
            "corridor_m": sample.itinerary.corridor_m,
            "waypoints": [
                {
                    "name": w.name,
                    "lat": w.lat,
                    "lon": w.lon,
                    "dwell_minutes": w.dwell_minutes,
                }
                for w in sample.itinerary.waypoints
            ],
        },
        "zones": [
            {
                "name": z.name,
                "category": z.category,
                "risk_level": z.risk_level,
                "geom": z.geom,
            }
            for z in sample.zones
        ],
    }
    GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    GOLDEN_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    print("loading dataset…", flush=True)
    windows, source = load_or_generate()
    print(f"  source={source}  n={len(windows)}", flush=True)
    print("extracting features…", flush=True)
    x, y, scenarios = extract_matrix(windows)
    assert x.shape[1] == N_FEATURES

    train_idx, test_idx = _split(y)
    x_train, y_train = x[train_idx], y[train_idx]
    x_test, y_test = x[test_idx], y[test_idx]
    scen_test = [scenarios[i] for i in test_idx]

    print(
        f"fitting IsolationForest contamination={CONTAMINATION} "
        f"on {x_train.shape[0]} windows…",
        flush=True,
    )
    # Unsupervised: labels are not used for fitting.
    pipeline = train_iforest(x_train)
    scaler_spec = export_scaler_json(pipeline)
    save_sklearn(pipeline)
    export_onnx(pipeline, x_train[:8])

    calib = _calibrate_onnx(pipeline, scaler_spec, x_test[: min(256, x_test.shape[0])])
    print(f"ONNX calibration: {calib}", flush=True)

    threshold = anomaly_threshold()
    d_train = np.asarray(pipeline.decision_function(x_train), dtype=np.float64)
    inliers = d_train[d_train > 0]
    score_scale = float(np.median(inliers)) if inliers.size else 0.25
    scaler_spec["score_scale"] = score_scale
    SCALER_JSON_PATH.write_text(json.dumps(scaler_spec, indent=2), encoding="utf-8")

    train_scores = decision_to_unit(d_train, threshold=threshold, scale=score_scale)
    test_scores = decision_to_unit(
        np.asarray(pipeline.decision_function(x_test), dtype=np.float64),
        threshold=threshold,
        scale=score_scale,
    )
    y_pred_train = (train_scores >= threshold).astype(np.int32)
    y_pred_test = (test_scores >= threshold).astype(np.int32)

    holdout = _metrics(y_test, y_pred_test)
    holdout["threshold"] = threshold
    holdout["n_train"] = int(x_train.shape[0])
    holdout["n_test"] = int(x_test.shape[0])
    train_m = _metrics(y_train, y_pred_train)

    per_scenario: dict[str, dict[str, float]] = {}
    rows: list[tuple[str, dict[str, float]]] = [("HOLD-OUT", holdout), ("train", train_m)]
    for name in sorted(set(scen_test)):
        mask = np.array([s == name for s in scen_test])
        # For normal-trek, "positive" is anomaly; report detection stats only when labels mix.
        m = _metrics(y_test[mask], y_pred_test[mask])
        per_scenario[name] = m
        rows.append((name, m))
    _print_table(rows)

    cm = confusion_matrix(y_test, y_pred_test, labels=[0, 1])
    print("confusion matrix (true\\pred):\n", cm)
    _write_confusion_png(cm, ARTIFACTS_DIR / "confusion_matrix.png")

    meta = {
        "model_version": MODEL_VERSION,
        "algorithm": "IsolationForest",
        "contamination": CONTAMINATION,
        "n_features": N_FEATURES,
        "feature_names": list(FEATURE_NAMES),
        "threshold": threshold,
        "holdout": holdout,
        "train": train_m,
        "per_scenario": per_scenario,
        "confusion_matrix": {"tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]), "tp": int(cm[1, 1])},
        "dataset_source": source,
        "score_scale": score_scale,
        **calib,
    }
    MODEL_META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    METRICS_PATH.write_text(json.dumps(holdout, indent=2), encoding="utf-8")
    (ARTIFACTS_DIR / "feature_names.json").write_text(
        json.dumps(list(FEATURE_NAMES), indent=2), encoding="utf-8"
    )
    header = ",".join([*FEATURE_NAMES, "label", "scenario"])
    lines = [header]
    for row, label, scen in zip(x, y, scenarios):
        lines.append(
            ",".join([f"{v:.8f}" for v in row] + [str(int(label)), scen])
        )
    (ARTIFACTS_DIR / "train_features.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")

    _write_golden(windows, x)

    # Final sklearn vs ONNX check on the golden vector.
    model = load_model()
    gx = x[[windows.index(next(w for w in windows if w.label == 0))]]
    sk = model.predict_sklearn(gx)
    onx = model.predict_onnx(gx)
    err = float(np.max(np.abs(sk.decision - onx.decision)))
    print(f"sklearn vs ONNX |Δ decision| max = {err:.3e}")
    if err > 1e-5:
        print(
            "WARNING: sklearn/ONNX disagreement exceeds 1e-5. "
            "Check model_meta.json onnx_kind/onnx_offset.",
            file=sys.stderr,
        )
        return 1
    print(f"wrote artifacts → {ARTIFACTS_DIR}")
    print(f"scaler.json → {SCALER_JSON_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
