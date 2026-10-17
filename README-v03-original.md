# Hà Nội · Ca đêm — First-person playtest 0.3

A playable 3D street-cleaning prototype inspired by Hanoi, with a complete collection/delivery loop, procedural Three.js scenery, local solo play and shared Cloudflare D1 rooms. Source and deployment are managed by Sites.

## Play

Desktop mouse and keyboard are the primary target. Mouse: look. WASD/arrows: move. Shift: run without a cart. C: crouch. 1: broom. 2: scoop. Hold left mouse/E/Space: work. Q: grab/drop cart. F: temporary fragrance protection. M: map. H: help. Esc: pause/release pointer.

When pointer lock is unavailable, use the alternate control option and drag the right mouse button to look. Touch controls include movement, look, crouch, tools, mask, cart and work.

## Complete loop

1. Look down and sweep leaves toward a gathering spot. Crouching helps. Wet leaves take longer to sweep.
2. Switch to the scoop and collect the resulting piles into an 18-unit bag.
3. Release the cart and hold E toward it to empty the bag. Each cart holds 36 units.
4. Grab the cart and push it into either marked yellow collection bay. Hold E while holding the cart to hand over the contents. Only handover contributes to the shared delivery target.
5. In rain, use the scoop to unblock drains. Water recedes after clearing. Teams of four or more have six drains; smaller teams have three.

Full carts move more slowly, wheels rotate, and the visible load tracks stored contents. Carts have ownership and building collision. The map marks carts, piles, drains, collection bays and teammates. The HUD provides contextual instructions and a four-step guide. The result screen credits sweeping, scooping, transport distance and drain work.

Choose a relaxed session without a timeout or an eight-minute shift. Mixed weather gives a visible countdown to rain, scheduled between 65 and 95 seconds. Initial leaf placement varies, with several introductory patches near spawn. New litter is bounded to keep prolonged relaxed play manageable. The flower-fragrance debuff is a fictional game mechanic; mask protection lasts 22 seconds with a 30-second cooldown.

## Graphics and audio

Layered instanced foliage, branched trees, weathered plaster and paving maps, granular asphalt, wet-road response, balcony laundry, facade numbers, shop signage, rooftop tanks, visible drain blockage, animated water ripples, broom fibers and a separate first-person scoop. PBR surfaces use procedural bump/roughness textures and an environment light. The setting is artistically inspired by Hanoi; it is not a photographic reconstruction of a real street.

Synthetic work/footstep sounds and a subtle weather layer begin only after a user gesture. Sensitivity, FOV, quality, sound and optional head movement are adjustable. Head movement defaults off.

## Multiplayer and access

Solo simulation runs locally. Online rooms accept up to eight participants, using authoritative HTTP polling and compare-and-swap D1 updates. Session secrets are separate from public game state. Tool choice, pile contents, cart ownership/load and delivery progress are shared. Old room formats are rejected with a create-new-room message.

The hosted Site remains owner-private. Room codes do not grant Site access; friends need access to the Site separately. No public audience change has been made.

## Validation and limits

Run `node --test tests/game.test.mjs` and `node node_modules/typescript/bin/tsc --noEmit`.

24 automated checks cover the collection/delivery loop, capacities and load slowdown, shared piles, tool/posture/reach, wet leaves, drains, relaxed mode, timeout/win states, cart collision/ownership/disconnection, sequence replay, concurrent eight-participant API actions using SQLite through a D1 adapter, scene geometry and spawn clearance, and complete scripted physical shifts in all three weather modes.

The automated walking controller verifies reachability and completion, not human enjoyment or balance. Browser visual QA, pointer lock, real device frame rate and eight-device network play have not been verified in the authoring environment. This remains a gameplay playtest, not a commercial release candidate.

## Source

- `lib/game.ts`: shared simulation and objectives (state format 3).
- `lib/scene3d.ts`: world, materials, weather, avatars and first-person tools.
- `app/game-client.tsx`: controls, HUD, menus, audio and synchronization.
- `app/api/game/route.ts`: validated room actions, session identity and atomic state writes.
- `drizzle/`: unchanged D1 schema.
