#!/usr/bin/env bash
# Cloud Agent install phase for Smart Tourist Safety.
# Idempotent, durable repository bootstrap that runs AFTER checkout.
# Does NOT start long-running daemons/servers — that is start.sh / terminals.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Node 24 (pinned by .nvmrc / package.json engines) via nvm --------------
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install 24 >/dev/null
nvm alias default 24 >/dev/null
# Put Node 24 ahead of Cursor's bundled node (/exec-daemon) for this shell.
export PATH="$(dirname "$(nvm which 24)"):$PATH"

# --- pnpm (pinned by package.json packageManager) via corepack --------------
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@10.15.1 --activate >/dev/null

node -v
pnpm -v

# --- Workspace dependencies (also installs the Supabase CLI binary) ----------
pnpm install --frozen-lockfile

# --- Local dev env files ----------------------------------------------------
# Next.js reads env from the app dir (apps/web); tooling/simulator read ./.env.
# Generate them from the template with the fully-local, no-secret demo modes.
write_local_env() {
  local dest="$1"
  cp .env.example "$dest"
  sed -i \
    -e 's/^DB_MODE=.*/DB_MODE="supabase-local"/' \
    -e 's/^CHAIN_MODE=.*/CHAIN_MODE="disabled"/' \
    -e 's/^AI_MODE=.*/AI_MODE="rules-only"/' \
    -e 's/^NOTIFY_CHANNELS=.*/NOTIFY_CHANNELS="realtime"/' \
    "$dest"
}
write_local_env ".env"
write_local_env ".env.local"
write_local_env "apps/web/.env.local"

echo "install.sh complete"
