#!/usr/bin/env bash
# packages/contracts/install-libs.sh
# Clones forge-std and OpenZeppelin v5 into lib/ (no credit card, public GitHub).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p lib

if [[ ! -f lib/forge-std/src/Test.sol ]]; then
  rm -rf lib/forge-std
  git clone --depth 1 --branch v1.9.7 https://github.com/foundry-rs/forge-std.git lib/forge-std
fi

if [[ ! -f lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol ]]; then
  rm -rf lib/openzeppelin-contracts
  git clone --depth 1 --branch v5.2.0 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts
fi
