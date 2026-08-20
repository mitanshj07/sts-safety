#!/usr/bin/env bash
# Cloud Agent start phase for Smart Tourist Safety.
# Per-boot reconciliation: bring up the Docker daemon and the Supabase local
# stack (Postgres 15 + PostGIS, Auth, PostgREST, Realtime, Storage). Must be
# idempotent, tolerate restarts, and RETURN (the web dev server is a terminal).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
export PATH="$(dirname "$(nvm which 24)"):$PATH"

# --- Docker daemon (nested VM) ----------------------------------------------
# fuse-overlayfs is required; the kernel overlay driver cannot mount here.
sudo mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  printf '{\n  "storage-driver": "fuse-overlayfs",\n  "features": { "containerd-snapshotter": false }\n}\n' \
    | sudo tee /etc/docker/daemon.json >/dev/null
fi

if ! sudo docker info >/dev/null 2>&1; then
  echo "Starting dockerd..."
  # setsid fully detaches the daemon into its own session so it survives this
  # script returning; a plain `nohup ... &` gets reaped when start.sh exits.
  sudo sh -c 'setsid dockerd >/var/log/sts-dockerd.log 2>&1 </dev/null &'
  for _ in $(seq 1 45); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
sudo docker info >/dev/null 2>&1 || { echo "dockerd failed to start"; sudo tail -n 40 /var/log/sts-dockerd.log || true; exit 1; }

# Same-bridge container-to-container traffic must bypass bridge-netfilter,
# otherwise Supabase's services cannot reach Postgres in this nested VM.
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true

# Let the ubuntu user (and the Supabase CLI) talk to the daemon without sudo.
sudo chmod 666 /var/run/docker.sock

# --- Supabase local stack ---------------------------------------------------
# On boot dockerd auto-restarts the Supabase containers from the snapshot, so
# first wait for them to become healthy. Only if they don't come up do we run a
# clean `supabase start` (which recreates containers and applies migrations +
# seed from ./supabase). Both paths converge on a healthy, seeded stack.
ready=0
for _ in $(seq 1 60); do
  if pnpm exec supabase status >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "Supabase not healthy from restart; starting a fresh local stack..."
  pnpm exec supabase stop >/dev/null 2>&1 || true
  pnpm exec supabase start
fi

# Readiness check against the API gateway (any HTTP reply means it's up).
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:54321/rest/v1/" 2>/dev/null || echo 000)"
  [ "$code" != "000" ] && break
  sleep 1
done
echo "Supabase status:"
pnpm exec supabase status 2>/dev/null | sed -n '1,12p' || true

echo "start.sh complete — Supabase up; run 'pnpm --filter @sts/web dev' (or use the 'web' terminal)."
