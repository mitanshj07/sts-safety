#!/usr/bin/env bash
# tools/seed-data/export-pmtiles.sh
#
# Build an offline Northeast India basemap as PMTiles for
# NEXT_PUBLIC_MAP_TILE_MODE=pmtiles-local.
#
# Geofabrik does not publish a dedicated North-East extract, so this clips
# asia/india-latest.osm.pbf to the eight NE states + Sikkim bbox, then
# converts with osmium + tippecanoe.
#
# Dependencies (all free):
#   curl, osmium-tool (>=1.16), tippecanoe (>=2.17)
# macOS:  brew install osmium-tool tippecanoe
# Debian: apt-get install osmium-tool tippecanoe
#
# Usage:
#   bash tools/seed-data/export-pmtiles.sh
#   SKIP_DOWNLOAD=1 bash tools/seed-data/export-pmtiles.sh   # reuse cached PBF
#
# Output (gitignored *.pmtiles):
#   apps/web/public/tiles/northeast.pmtiles
# Layer name inside the archive: `osm` (matches src/lib/geo/style.ts).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${ROOT}/apps/web/public/tiles"
WORK_DIR="${ROOT}/.cache/pmtiles"
PBF_URL="https://download.geofabrik.de/asia/india-latest.osm.pbf"
# West,South,East,North — Sikkim through Arunachal, Tripura through Assam
NE_BBOX="88.00,21.90,97.50,29.50"
MAX_ZOOM="${MAX_ZOOM:-14}"

mkdir -p "${OUT_DIR}" "${WORK_DIR}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing dependency: $1" >&2
    exit 1
  fi
}

need curl
need osmium
need tippecanoe

INDIA_PBF="${WORK_DIR}/india-latest.osm.pbf"
NE_PBF="${WORK_DIR}/northeast.osm.pbf"
NE_SEQ="${WORK_DIR}/northeast.geojsonseq"
OUT_PMTILES="${OUT_DIR}/northeast.pmtiles"

if [[ "${SKIP_DOWNLOAD:-0}" != "1" || ! -s "${INDIA_PBF}" ]]; then
  echo ">> downloading ${PBF_URL}"
  echo "   (~1.6 GB; Geofabrik has no NE-only extract)"
  curl -L --fail --retry 3 -o "${INDIA_PBF}.partial" "${PBF_URL}"
  mv "${INDIA_PBF}.partial" "${INDIA_PBF}"
fi

echo ">> clipping India extract to Northeast bbox ${NE_BBOX}"
osmium extract \
  --overwrite \
  --bbox "${NE_BBOX}" \
  --strategy=simple \
  "${INDIA_PBF}" \
  -o "${NE_PBF}"

echo ">> exporting GeoJSONSeq (polygons + lines) for tippecanoe"
osmium export \
  --overwrite \
  --output-format=geojsonseq \
  --geometry-types=polygon,linestring \
  "${NE_PBF}" \
  -o "${NE_SEQ}"

echo ">> tippecanoe → ${OUT_PMTILES} (maxzoom ${MAX_ZOOM})"
tippecanoe \
  --force \
  --output="${OUT_PMTILES}" \
  --minimum-zoom=0 \
  --maximum-zoom="${MAX_ZOOM}" \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --no-tile-compression \
  --layer=osm \
  --name="Northeast India" \
  --attribution="© OpenStreetMap contributors" \
  "${NE_SEQ}"

ls -lh "${OUT_PMTILES}"
echo
echo "Done. Point the app at local tiles:"
echo "  NEXT_PUBLIC_MAP_TILE_MODE=pmtiles-local"
echo "  NEXT_PUBLIC_PMTILES_URL=/tiles/northeast.pmtiles"
echo
echo "Optional (Protomaps/OpenMapTiles schema, richer style):"
echo "  planetiler --osm-path ${NE_PBF} --output ${OUT_PMTILES}"
