#!/usr/bin/env bash
# Long-running Next.js dev server for the tourist PWA + command centre.
# Runs as a Cloud Agent terminal so its logs stay visible.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
export PATH="$(dirname "$(nvm which 24)"):$PATH"

exec pnpm --filter @sts/web dev
