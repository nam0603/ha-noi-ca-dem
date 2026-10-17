# Hà Nội · Ca đêm

Read `README.md`, `docs/HANDOFF.md`, and `docs/ROADMAP-0.4.md` first.

## Product
- Existing 0.4 first-person 3D sanitation worker co-op prototype inspired by Hanoi.
- Preserve first-person view, broom/scoop, crouching, cart transport, flood/drain work, solo and 1–8-player rooms.
- Develop the current game; do not replace it with a new template, 2D game, Telegram game, or concept image.
- UI language: Vietnamese. Desktop keyboard and mouse are the main target; preserve available touch controls.

## Toolchain
- Node >=22.13.0; Node 24 LTS recommended. `node:sqlite` is used by tests.
- pnpm 11.25.0 and the committed `pnpm-lock.yaml`. Do not switch package managers or casually refresh the lockfile.
- React 19, Vinext/Vite, Three.js, Cloudflare Worker/D1. This is not a plain Next.js/Node server: API routes import `cloudflare:workers`.
- Fresh environment setup: `bash scripts/codex-setup.sh`.
- Checks: `npm test`, `npm run typecheck`, `npm run build`.
- Local game: `npm run dev`, default port 5173. Local D1: `npm run db:local`.
- Local development uses an empty fresh database, not the live Site's rooms.

## Working rules
- Put authoritative simulation in `lib/game.ts`, 3D rendering in `lib/scene3d.ts`, inputs/HUD in `app/game-client.tsx`, validated room actions in `app/api/game/route.ts`.
- Keep client/server mechanics consistent; preserve capacity limits, cart ownership, sequence replay protection and atomic room writes.
- For incompatible serialized state changes, version the game format and show a clear message for old rooms.
- Add focused behavior tests for changed mechanics; keep full scripted shift and 8-player concurrency coverage.
- Report actual commands and results. Separate automated checks, HTTP smoke checks, browser checks and real multiplayer playtests. Never claim graphics quality, FPS, enjoyment or eight-device stability from unit tests.
- Keep credentials, `.env*`, `.wrangler`, `.sites-runtime`, dependencies and built output out of Git.
- `.openai/hosting.json` retains the existing Site identity for handoff. Changing GitHub code does not itself update the live demo. No production deployment or audience change is part of the migration task.
