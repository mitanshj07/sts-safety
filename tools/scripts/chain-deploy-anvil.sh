#!/usr/bin/env bash
# tools/scripts/chain-deploy-anvil.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then set -a; # shellcheck disable=SC1091
  source .env.local; set +a; fi
if [[ -f .env ]]; then set -a; # shellcheck disable=SC1091
  source .env; set +a; fi

ANVIL_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ANVIL_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
RPC="${LOCAL_RPC_URL:-http://127.0.0.1:8545}"

KEY="${ISSUER_PRIVATE_KEY:-$ANVIL_PK}"
if [[ "$KEY" == 0x0000000000000000000000000000000000000000000000000000000000000000 ]]; then
  KEY="$ANVIL_PK"
fi
ADDR="${ISSUER_ADDRESS:-$ANVIL_ADDR}"
if [[ "$ADDR" == 0x0000000000000000000000000000000000000000 ]]; then
  ADDR="$ANVIL_ADDR"
fi

export ISSUER_PRIVATE_KEY="$KEY"
export ISSUER_ADDRESS="$ADDR"

bash packages/contracts/install-libs.sh
(cd packages/contracts && forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url "$RPC" --private-key "$KEY")
