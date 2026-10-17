#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node --input-type=module -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22||(major===22&&minor<13)) { console.error("Use Node.js >=22.13.0 (Node 24 LTS recommended)."); process.exit(1); }'
if command -v corepack >/dev/null 2>&1; then
  pm=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1 && [[ "$(pnpm --version)" == "11.25.0" ]]; then
  pm=(pnpm)
else
  pm=(npx --yes pnpm@11.25.0)
fi

"${pm[@]}" install --frozen-lockfile
npm run db:local
npm test
npm run typecheck
