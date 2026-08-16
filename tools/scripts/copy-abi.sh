#!/usr/bin/env bash
# tools/scripts/copy-abi.sh
# Copies Foundry ABIs into the Next.js app as `as const` TypeScript modules.
# Phase 7 ships human-readable parseAbi modules; this script overwrites them
# once `forge build` has produced out/.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/packages/contracts/out"
dest="$root/apps/web/src/lib/chain/abi"

copy_one() {
  local name="$1"
  local src="$out/$name.sol/$name.json"
  if [[ ! -f "$src" ]]; then
    echo "skip $name (forge out missing)"
    return 0
  fi
  node --input-type=module -e "
    import { readFileSync, writeFileSync } from 'node:fs';
    const json = JSON.parse(readFileSync('$src', 'utf8'));
    const abi = JSON.stringify(json.abi, null, 2);
    writeFileSync('$dest/$name.ts', '// apps/web/src/lib/chain/abi/$name.ts\nexport const ${name[0].toLowerCase()}${name.slice(1)}Abi = ' + abi + ' as const;\n');
  "
  echo "wrote $dest/$name.ts"
}

mkdir -p "$dest"
copy_one TouristIdentityRegistry
copy_one IncidentAnchor
