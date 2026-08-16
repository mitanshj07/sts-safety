---
title: Tourist Safety Scoring
emoji: 🛡️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
---

# services/ai/README.md

FastAPI IsolationForest service for the SIH 2025 Smart Tourist Safety system.
Deployed on **Hugging Face Spaces, CPU Basic** (no credit card).

The geofencing engine still lives in Postgres. This Space is an enhancement:
if it is cold, down, or slow, the Next.js app falls back to `onnxruntime-node`
(`ONNX_MODEL_PATH`) and then to rules-only scoring. Alerts still fire.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | liveness + whether sklearn / ONNX artifacts loaded |
| GET | `/model/info` | feature names, contamination, hold-out metrics |
| POST | `/score` | one ping window → anomaly + safety score + factor breakdown |
| POST | `/score/batch` | up to 32 windows |

`POST /score` body: `{ pings, itinerary?, zones?, open_high_incidents? }`.
Pings are timezone-aware ISO-8601. Itinerary coordinates are GeoJSON `[lon, lat]`.

Response: `{ anomaly_score, is_anomaly, safety_score, factors[], model_version, features, stops }`.

`anomaly_score` is in `[0, 1]` (higher = more anomalous). `is_anomaly` uses
`ANOMALY_THRESHOLD` from `.env.example` (default `0.72`).

## 18-feature vector

Order is frozen in `app/features.py` (`FEATURE_NAMES`) and imported on the TS
side from `@sts/shared` (`packages/shared/src/constants/feature-vector.ts`).

Do not reorder without bumping `MODEL_VERSION`.

## Train & export

From `services/ai`:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m app.train          # writes artifacts/, tests/golden_vector.json
pytest -q
```

Training uses `tools/seed-data/trajectories.csv` when Phase 10 has produced it;
otherwise `app/synthetic.py` generates 5,000 normal + 500 anomalous windows
(same scenario mix). IsolationForest is unsupervised — labels are only used
for the precision / recall / F1 table.

Artifacts (committed, used by the Vercel ONNX fallback):

- `artifacts/iforest.onnx` — IsolationForest, expects **scaled** float32 input
- `artifacts/scaler.json` — StandardScaler `mean` / `scale`
- `artifacts/iforest.pkl` — sklearn `Pipeline(scaler, iforest)`
- `artifacts/model_meta.json` — metrics + ONNX output mapping

## Local server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 7860
```

CORS allows `NEXT_PUBLIC_APP_URL`, `localhost:3000`, `*.vercel.app`, and `*.hf.space`.

## Hugging Face Space

1. Create a Space: **Docker**, hardware **CPU Basic**, no token required for public.
2. Point it at this directory (or copy `Dockerfile`, `requirements.txt`, `app/`, `artifacts/`).
3. Set `ANOMALY_THRESHOLD=0.72` and `NEXT_PUBLIC_APP_URL` in the Space secrets/variables
   (both already exist in `.env.example` — do not invent new names).
4. Space URL goes in `HF_SPACE_URL`. Keep `HF_SPACE_TIMEOUT_MS=8000` so the web
   app falls back to ONNX instead of stalling on a cold start.

## Browser / Vercel ONNX fallback — feature availability

The ONNX file is **only** the IsolationForest. Feature extraction is not in
the graph. A Route Handler that loads `iforest.onnx` must rebuild the 18-vector
in TypeScript first, apply `scaler.json`, then run ONNX.

| Feature | Available in the TS/ONNX fallback? |
| --- | --- |
| speed mean/std/max, accel std, bearing entropy | Yes — haversine/bearing already in `@sts/shared` |
| ping gap mean/max, battery slope, n_pings, duration, total distance | Yes |
| radius of gyration, straightness | Yes |
| night fraction | Yes — `istHour` in `@sts/shared` |
| itinerary distance | Yes, if you port `point_to_linestring_m` (Turf.js `nearestPointOnLine` is the equivalent; shapely is **not** available in Node) |
| zone-risk-weighted dwell | Yes, if zone polygons are sent to the Route Handler (Turf `booleanPointInPolygon`) |
| stop_count / stop_duration | **Partial.** sklearn `DBSCAN` is not in ONNX. The fallback must reimplement DBSCAN (eps=50 m, precomputed haversine) or substitute a speed-threshold heuristic — scores will then diverge from this Space. |

Stop-type classification (accommodation vs anomalous roadside) is also Python-only
today; the safety-score night penalty can still use a zone-category check in TS.
