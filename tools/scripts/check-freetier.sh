#!/usr/bin/env bash
# tools/scripts/check-freetier.sh
# Fails if any paid-tier env var matching STRIPE|TWILIO|MAPBOX|AWS_|GOOGLE_MAPS is set.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PATTERN='^(STRIPE|TWILIO|MAPBOX|AWS_|GOOGLE_MAPS)[A-Za-z0-9_]*='
FORBIDDEN_RE='^(STRIPE|TWILIO|MAPBOX|AWS_|GOOGLE_MAPS)'

fail() {
  echo "check:freetier FAILED: $*" >&2
  exit 1
}

# Process environment (non-empty values only).
while IFS='=' read -r name value; do
  [[ -z "${name}" ]] && continue
  if [[ "${name}" =~ ${FORBIDDEN_RE} ]] && [[ -n "${value}" ]]; then
    fail "paid-tier environment variable is set: ${name}"
  fi
done < <(env)

# Env files — ignore comments and empty assignments.
ENV_FILES=(
  .env
  .env.local
  .env.development
  .env.production
  apps/web/.env
  apps/web/.env.local
)

for file in "${ENV_FILES[@]}"; do
  [[ -f "${file}" ]] || continue
  matches="$(grep -E "${PATTERN}" "${file}" | grep -vE '^\s*#' || true)"
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    name="${line%%=*}"
    value="${line#*=}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [[ -n "${value}" ]]; then
      fail "paid-tier variable ${name} found in ${file}"
    fi
  done <<< "${matches}"
done

echo "check:freetier passed — no STRIPE|TWILIO|MAPBOX|AWS_|GOOGLE_MAPS variables set."
