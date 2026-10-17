#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node --input-type=module -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22||(major===22&&minor<13)) { console.error("Use Node.js >=22.13.0 (Node 24 LTS recommended)."); process.exit(1); }'
# Portable clouds may have no writable home cache. Keep package-manager state local.
export COREPACK_HOME="${COREPACK_HOME:-${PWD}/.sites-runtime/corepack}"
export npm_config_cache="${npm_config_cache:-${PWD}/.sites-runtime/npm-cache}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-${PWD}/.sites-runtime/xdg-cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-${PWD}/.sites-runtime/xdg-data}"
mkdir -p "$COREPACK_HOME" "$npm_config_cache" "$XDG_CACHE_HOME" "$XDG_DATA_HOME"
if command -v corepack >/dev/null 2>&1; then
  pm=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1 && [[ "$(pnpm --version)" == "11.25.0" ]]; then
  pm=(pnpm)
else
  pm=(npx --yes pnpm@11.25.0)
fi

CI=true "${pm[@]}" install --frozen-lockfile --store-dir "${PWD}/.sites-runtime/pnpm-store"
npm run db:local
npm test
npm run typecheck
