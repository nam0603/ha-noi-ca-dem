import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as THREE from 'three';
const temp = path.resolve('.sites-runtime/test-modules');
fs.mkdirSync(temp, { recursive: true });
function compile(src, dst, transform = (s) => s) {
  const js = ts.transpileModule(transform(fs.readFileSync(src, 'utf8')), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  fs.writeFileSync(path.join(temp, dst), js);
}
compile('lib/street-colliders.ts', 'street-colliders.mjs');
compile('lib/view-controls.ts', 'view-controls.mjs');
compile('lib/game.ts', 'game.mjs', (s) =>
  s.replace(/(['"])\.\/street-colliders\1/gu, "'./street-colliders.mjs'"),
);
compile('lib/input-sync.ts', 'input-sync.mjs', (s) =>
  s.replace(/(['"])\.\/game\1/gu, "'./game.mjs'"),
);
const {
  newGame,
  joinGame,
  startGame,
  tickWorld,
  movePlayer,
  applyInput,
  applyInputBatch,
  rainy,
  walkable,
  waterDepth,
  taskAt,
  grabCart,
  releaseOrphanCarts,
  contextHint,
  zoneAt,
  zoneRemaining,
  zoneGoal,
  refreshZones,
  addLeaves,
  removePlayers,
  pingAt,
  onboardingHint,
  clearPath,
  clearMovementPath,
  repairStaticPropOverlaps,
  DEPOTS,
  CART_CAPACITY,
} = await import(path.join(temp, 'game.mjs'));
const { createInputHistory, nextInputSequence } = await import(
  path.join(temp, 'input-sync.mjs')
);
const { clampViewPitch } = await import(path.join(temp, 'view-controls.mjs'));
const {
  STATIC_PROP_COLLIDERS,
  INSTRUCTION_BOARD,
  PARKED_SCOOTERS,
  CAFE_TABLES,
} = await import(path.join(temp, 'street-colliders.mjs'));
const no = {
  x: 0,
  y: 0,
  work: false,
  sprint: false,
  mask: false,
  crouch: false,
  pitch: 0,
  yaw: -Math.PI / 2,
};
function game(season = 'autumn') {
  const g = newGame(season, 1000);
  const p = joinGame(g, 'test-player', 'Nam', 1000);
  startGame(g, p.id, 1000);
  return { g, p };
}
function frames(g, p, input, n) {
  for (let i = 0; i < n; i++) movePlayer(g, p, { ...no, ...input }, 0.1);
}
function leafSetup() {
  const { g, p } = game();
  Object.assign(p, { x: 100, y: 700, face: 0, pitch: 0 });
  g.leaves = [{ id: 1, x: 125, y: 700, hp: 1, kind: 0 }];
  return { g, p };
}
const mass = (g) =>
  g.leaves.length +
  g.piles.reduce((n, p) => n + p.amount, 0) +
  g.players.reduce((n, p) => n + p.bag, 0) +
  g.carts.reduce((n, c) => n + c.stored, 0) +
  g.score;
test('look down, sweep into a pile, switch to scoop and collect; no automatic scoring', () => {
  const { g, p } = leafSetup();
  frames(g, p, { work: true }, 15);
  assert.equal(g.leaves.length, 1);
  frames(g, p, { work: true, pitch: -0.7 }, 10);
  assert.equal(g.leaves.length, 0);
  assert.equal(g.piles.length, 1);
  assert.equal(p.bag, 0);
  frames(g, p, { work: true, pitch: -0.7, tool: 'scoop' }, 8);
  assert.equal(p.bag, 1);
  assert.equal(g.piles.length, 0);
  assert.equal(g.score, 0);
  assert.equal(p.swept, 1);
  assert.equal(p.picked, 1);
});
test('sweep cannot collect behind player or outside arm reach', () => {
  const { g, p } = leafSetup();
  g.leaves = [
    { id: 1, x: 70, y: 700, hp: 1, kind: 0 },
    { id: 2, x: 150, y: 700, hp: 1, kind: 1 },
  ];
  frames(g, p, { work: true, crouch: true }, 20);
  assert.equal(g.leaves.length, 2);
  assert.equal(p.bag, 0);
});
test('crouching increases sweep speed but slows walking', () => {
  const a = leafSetup(),
    b = leafSetup();
  frames(a.g, a.p, { work: true, pitch: -0.7 }, 6);
  frames(b.g, b.p, { work: true, crouch: true }, 6);
  assert.equal(a.g.leaves.length, 1);
  assert.equal(b.g.leaves.length, 0);
  frames(a.g, a.p, { x: 1 }, 5);
  frames(b.g, b.p, { x: 1, crouch: true }, 5);
  assert(a.p.x > b.p.x);
});
test('bag and cart capacities, partial dumping, and depot scoring conserve collected trash', () => {
  const { g, p } = leafSetup();
  g.piles = [{ id: 9, x: 125, y: 700, amount: 5, progress: 0 }];
  p.bag = 17;
  frames(g, p, { work: true, crouch: true, tool: 'scoop' }, 8);
  assert.equal(p.bag, 18);
  assert.equal(g.piles[0].amount, 4);
  g.carts[0].x = 120;
  g.carts[0].y = 700;
  g.carts[0].stored = 35;
  frames(g, p, { work: true }, 5);
  assert.equal(p.bag, 17);
  assert.equal(g.carts[0].stored, CART_CAPACITY);
  assert.equal(g.score, 0);
  Object.assign(p, { x: DEPOTS[0].x, y: DEPOTS[0].y + 26, face: -Math.PI / 2 });
  Object.assign(g.carts[0], { x: p.x, y: p.y - 26, owner: p.id });
  p.pushing = g.carts[0].id;
  frames(g, p, { work: true, yaw: 0 }, 10);
  assert.equal(g.score, 8);
  assert.equal(g.carts[0].stored, 28);
  assert.equal(p.score, 8);
});
test('full bag still permits sweeping and an empty cart does not absorb leaves', () => {
  const { g, p } = leafSetup();
  p.bag = 18;
  frames(g, p, { work: true, crouch: true }, 7);
  assert.equal(g.leaves.length, 0);
  assert.equal(g.piles[0].amount, 1);
  assert.equal(p.bag, 18);
});
test('heavy carts are slower than empty carts, sprint cannot cancel load', () => {
  const a = game(),
    b = game();
  for (const v of [a, b]) {
    Object.assign(v.p, { x: 370, y: 700, face: 0 });
    grabCart(v.g, v.p);
  }
  b.g.carts[0].stored = 36;
  frames(a.g, a.p, { x: 1, sprint: true }, 5);
  frames(b.g, b.p, { x: 1, sprint: true }, 5);
  assert(a.p.x > b.p.x + 7);
  assert(b.p.cartDistance > 0);
});
test('wet leaves take longer to gather than dry leaves', () => {
  const a = leafSetup(),
    b = leafSetup();
  b.g.season = 'rain';
  frames(a.g, a.p, { work: true, crouch: true }, 6);
  frames(b.g, b.p, { work: true, crouch: true }, 6);
  assert.equal(a.g.piles.length, 1);
  assert.equal(b.g.piles.length, 0);
});
test('two players cannot duplicate the same pile contents', () => {
  const { g, p } = leafSetup();
  g.leaves = [];
  g.piles = [{ id: 9, x: 125, y: 700, amount: 3, progress: 0 }];
  const b = joinGame(g, 'second-player', 'Bạn', 1000);
  Object.assign(b, { x: 100, y: 700, face: 0 });
  for (let i = 0; i < 10; i++) {
    frames(g, p, { work: true, crouch: true, tool: 'scoop' }, 1);
    frames(g, b, { work: true, crouch: true, tool: 'scoop' }, 1);
  }
  assert.equal(p.bag + b.bag, 3);
  assert.equal(g.piles.length, 0);
});
test('Q grabs a cart, pushes with movement and drops it; no sweeping while pushing', () => {
  const { g, p } = game();
  Object.assign(p, { x: 370, y: 700, face: 0 });
  grabCart(g, p);
  const c = g.carts[0];
  assert.equal(p.pushing, c.id);
  assert.equal(c.owner, p.id);
  const x = c.x;
  frames(g, p, { x: 1 }, 10);
  assert(c.x > x);
  assert(Math.abs(c.x - p.x - 26) < 0.001);
  p.bag = 5;
  frames(g, p, { work: true }, 10);
  assert.equal(p.bag, 5);
  grabCart(g, p);
  assert.equal(c.owner, null);
  assert.equal(p.pushing, null);
});
test('cart collision prevents pushing through shop walls and orphan owners are released', () => {
  const { g, p } = game();
  p.x = 100;
  p.y = 340;
  p.face = Math.PI / 2;
  const c = g.carts[0];
  c.x = 100;
  c.y = 365;
  c.owner = p.id;
  p.pushing = c.id;
  frames(g, p, { y: 1, yaw: Math.PI }, 40);
  assert(c.y <= 375);
  g.players = [];
  releaseOrphanCarts(g);
  assert.equal(c.owner, null);
});
test('another player cannot grab an owned cart', () => {
  const { g, p } = game();
  Object.assign(p, { x: 370, y: 700, face: 0 });
  grabCart(g, p);
  const b = joinGame(g, 'second-player', 'Bạn', 1000);
  Object.assign(b, { x: p.x, y: p.y, face: 0 });
  grabCart(g, b);
  assert.equal(b.pushing, null);
  assert.equal(g.carts[0].owner, p.id);
});
test('flower headache builds, slows movement and responds to mask', () => {
  const { g, p } = game();
  p.x = 520;
  p.y = 300;
  frames(g, p, {}, 70);
  assert(p.headache > 65);
  movePlayer(g, p, { ...no, mask: true }, 0.1);
  assert(p.mask > 9);
  frames(g, p, {}, 30);
  assert.equal(p.headache, 0);
  assert(p.cooldown > 25);
});
test('wading is slower; drains require looking down and water recedes after clearing', () => {
  const { g, p } = game('rain');
  Object.assign(p, { x: 170, y: 355, face: 0 });
  assert(waterDepth(g, p) > 0.1);
  frames(g, p, { work: true }, 70);
  assert.equal(g.drains[0].clog, 1);
  frames(g, p, { work: true, crouch: true }, 70);
  assert.equal(g.drains[0].clog, 1);
  frames(g, p, { work: true, crouch: true, tool: 'scoop' }, 70);
  assert.equal(g.drains[0].clog, 0);
  const water = g.drains[0].water;
  tickWorld(g, 3000);
  assert(g.drains[0].water < water);
  const a = game('autumn'),
    b = game('rain');
  Object.assign(a.p, { x: 200, y: 320 });
  Object.assign(b.p, { x: 200, y: 320 });
  frames(a.g, a.p, { x: 1 }, 5);
  frames(b.g, b.p, { x: 1 }, 5);
  assert(a.p.x > b.p.x + 10);
});
test('weather is announced before randomized rain and relaxed mode has no timeout', () => {
  const { g } = game('mixed');
  const n = g.leaves.length;
  assert(g.rainAt >= 65 && g.rainAt <= 95);
  for (let i = 1; i <= g.rainAt; i++) tickWorld(g, 1000 + i * 1000);
  assert(rainy(g));
  assert(g.leaves.length > n);
  assert.equal(g.duration, 480);
  const relaxed = newGame('autumn', 1000, 'relaxed');
  joinGame(relaxed, 'p', 'Nam', 1000);
  startGame(relaxed, 'p', 1000);
  for (let i = 1; i <= 600; i++) tickWorld(relaxed, 1000 + i * 1000);
  assert.equal(relaxed.status, 'playing');
  assert.equal(relaxed.time, 600);
});
test('win conditions and timeout are enforced', () => {
  let { g } = game();
  g.score = g.target;
  g.zones[0].completedAt = 0;
  tickWorld(g, 1100);
  assert.equal(g.status, 'won');
  ({ g } = game('rain'));
  g.score = g.target;
  g.zones[0].completedAt = 0;
  tickWorld(g, 1100);
  assert.equal(g.status, 'playing');
  g.drains.forEach((d) => (d.clog = 0));
  tickWorld(g, 1200);
  assert.equal(g.status, 'won');
  ({ g } = game());
  for (let i = 1; i <= 480; i++) tickWorld(g, 1000 + i * 1000);
  assert.equal(g.status, 'lost');
});
test('walls, map bounds and tree trunks have collision; diagonals do not move faster', () => {
  const { g, p } = game();
  p.x = 100;
  p.y = 360;
  frames(g, p, { y: 1 }, 100);
  assert(p.y <= 380);
  assert(!walkable(90, 253));
  assert(!walkable(500, 450));
  assert(walkable(405, 450));
  const a = game(),
    b = game();
  a.p.x = b.p.x = 100;
  a.p.y = b.p.y = 700;
  movePlayer(a.g, a.p, { ...no, x: 1 }, 0.1);
  movePlayer(b.g, b.p, { ...no, x: 1, y: 1 }, 0.1);
  assert(
    Math.abs(Math.hypot(b.p.x - 100, b.p.y - 700) - (a.p.x - 100)) < 0.001,
  );
});
test('8-player limit, host start and restart resets carts', () => {
  const g = newGame('mixed', 1000);
  for (let i = 0; i < 8; i++) joinGame(g, 'p' + i, 'Player ' + i, 1000);
  assert.throws(() => joinGame(g, 'p8', 'Ninth', 1000), /8 người/);
  assert.throws(() => startGame(g, 'p1', 1000), /chủ phòng/);
  startGame(g, 'p0', 1000);
  assert.equal(g.target, 108);
  assert.equal(g.drains.length, 6);
  g.carts[0].owner = 'p0';
  g.players[0].pushing = 'cart0';
  g.status = 'lost';
  startGame(g, 'p0', 2000);
  assert.equal(g.score, 0);
  assert.equal(g.carts[0].owner, null);
  assert.equal(g.players[0].pushing, null);
});
test('stale sequence numbers cannot duplicate movement or grab actions', () => {
  const { g, p } = game();
  p.x = 370;
  p.y = 700;
  applyInput(g, p.id, { ...no, grab: true }, 1100, 1);
  assert.equal(p.pushing, 'cart0');
  applyInput(g, p.id, { ...no, grab: true }, 1200, 1);
  assert.equal(p.pushing, 'cart0');
  const x = p.x;
  applyInput(g, p.id, { ...no, x: 1 }, 1050, 2);
  assert.equal(p.x, x);
  tickWorld(g, 2000);
  tickWorld(g, 1500);
  assert.equal(g.lastTick, 2000);
});
test('trimmed input history drops zero-duration prefix edges and retains current edges', () => {
  const { g, p } = game();
  Object.assign(p, { x: 370, y: 700 });
  applyInputBatch(
    g,
    p.id,
    [
      { input: { ...no, grab: true }, dt: 0 },
      { input: no, dt: 1 },
    ],
    1100,
    1,
  );
  assert.equal(
    p.pushing,
    null,
    'an edge before the trusted elapsed window must be discarded',
  );
  applyInputBatch(
    g,
    p.id,
    [
      { input: no, dt: 1 },
      { input: { ...no, grab: true }, dt: 0 },
    ],
    1200,
    2,
  );
  assert.equal(
    p.pushing,
    'cart0',
    'a zero-duration edge at the retained end still works',
  );
});
test('bounded input history preserves short actions and release, and clears stale or paused work', () => {
  const history = createInputHistory(1000);
  history.sample({ ...no, grab: true }, 1050, true);
  history.sample({ ...no, x: 1 }, 1100, true);
  history.sample(no, 1150, true);
  const frames = history.take();
  assert.equal(frames.filter((frame) => frame.input.grab).length, 1);
  assert(frames.some((frame) => frame.input.x === 1));
  assert.equal(
    frames.at(-1).input.x,
    0,
    'a release before the HTTP send stays represented',
  );
  const { g, p } = game();
  Object.assign(p, { x: 370, y: 700 });
  applyInputBatch(g, p.id, frames, 1150, 1);
  assert.equal(
    p.pushing,
    'cart0',
    'substeps cannot toggle a single grab more than once',
  );
  const after = structuredClone(g);
  applyInputBatch(g, p.id, frames, 1150, 1);
  assert.deepEqual(
    g,
    after,
    'replaying an acknowledged packet cannot repeat its edge actions',
  );
  p.working = true;
  p.crouched = true;
  applyInputBatch(g, p.id, [], 1200, 2);
  assert.equal(
    p.working,
    false,
    'an empty history must stop the authoritative work pose',
  );
  assert.equal(p.crouched, false);
  assert.equal(p.pushing, 'cart0');
  history.sample({ ...no, work: true, x: 1 }, 1200, true);
  history.sample({ ...no, work: true, x: 1 }, 1250, false);
  assert.deepEqual(
    history.take(),
    [],
    'opening a panel discards pending held work',
  );
  history.sample({ ...no, work: true, x: 1 }, 4000, true);
  assert.deepEqual(
    history.take(),
    [],
    'a stalled client cannot enqueue missing seconds',
  );
  history.sample({ ...no, work: true, x: 1 }, 4050, true);
  history.clear(4060);
  assert.deepEqual(
    history.take(),
    [],
    'network errors and round/session resets can clear all old samples',
  );
  history.sample({ ...no, grab: true, mask: true, ping: true }, 4860, true);
  history.sample(no, 5160, true);
  const recent = history.take();
  assert(
    recent.some(
      (frame) => frame.input.grab && frame.input.mask && frame.input.ping,
    ),
    'trimming an older held interval must retain a recently observed endpoint edge',
  );
  history.sample({ ...no, grab: true, mask: true, ping: true }, 5210, true);
  history.sample(no, 6000, true);
  history.sample(no, 6260, true);
  const trimmed = history.take();
  assert(trimmed.length > 0);
  assert(
    !trimmed.some(
      (frame) => frame.input.grab || frame.input.mask || frame.input.ping,
    ),
    'an endpoint edge is discarded once it lies outside the retained history window',
  );
  for (let i = 1; i <= 100; i++)
    history.sample(
      { ...no, x: i % 2 ? 1 : -1, grab: i === 1 },
      6260 + i * 50,
      true,
    );
  const bounded = history.take();
  assert(bounded.length <= 32);
  assert(bounded.reduce((sum, frame) => sum + frame.dt, 0) <= 1 + 1e-6);
  assert(
    !bounded.some((frame) => frame.input.grab),
    'trimming history cannot replay an expired edge',
  );
});

test('delayed input packets preserve held movement and work without permitting stale catch-up or replay', () => {
  function run(interval, input, setup) {
    const { g, p } = leafSetup();
    setup?.(g, p);
    let elapsed = 0,
      seq = 0;
    while (elapsed < 2.36 - 1e-6) {
      const dt = Math.min(interval, 2.36 - elapsed);
      elapsed += dt;
      applyInputBatch(
        g,
        p.id,
        [{ input: { ...no, ...input }, dt }],
        1000 + elapsed * 1000,
        ++seq,
      );
    }
    return { g, p };
  }
  const quick = run(0.11, { x: 1 }),
    delayed = run(0.59, { x: 1 });
  assert(Math.abs(quick.p.x - delayed.p.x) < 1e-6);
  assert(
    Math.abs(delayed.p.x - (100 + 72 * 2.36)) < 1e-6,
    'a 590 ms response interval cannot reduce a valid held movement to the old 350 ms cap',
  );
  const fastWork = run(0.11, { work: true, crouch: true }),
    slowWork = run(0.59, { work: true, crouch: true });
  assert.equal(fastWork.p.swept, slowWork.p.swept);
  assert.equal(fastWork.p.swept, 1);
  assert.equal(mass(fastWork.g), mass(slowWork.g));

  const { g, p } = leafSetup();
  p.working = true;
  const before = { x: p.x, y: p.y, mass: mass(g), hp: g.leaves[0].hp };
  applyInputBatch(
    g,
    p.id,
    [
      {
        dt: 1,
        input: {
          ...no,
          x: 1,
          work: true,
          grab: true,
          mask: true,
          ping: true,
          crouch: true,
        },
      },
    ],
    6000,
    1,
  );
  assert.deepEqual(
    { x: p.x, y: p.y, mass: mass(g), hp: g.leaves[0].hp },
    before,
  );
  assert.equal(p.working, false);
  assert.equal(p.pushing, null);
  assert.equal(p.mask, 0);
  assert.equal(g.pings.length, 0);
  const x = p.x;
  applyInputBatch(g, p.id, [{ dt: 1, input: { ...no, x: 1 } }], 6100, 2);
  assert(
    Math.abs(p.x - x - 7.2) < 1e-6,
    'trusted elapsed time bounds client-reported duration',
  );
  const movement = p.x;
  applyInputBatch(g, p.id, [{ dt: 1, input: { ...no, x: 1 } }], 6200, 2);
  assert.equal(p.x, movement);
});

test('shared street props block approach but let old overlapping players walk out without teleporting', () => {
  assert(STATIC_PROP_COLLIDERS.length >= 10);
  for (const prop of [INSTRUCTION_BOARD, PARKED_SCOOTERS[0], CAFE_TABLES[0]])
    assert.equal(walkable(prop.x, prop.y), false, prop.id);
  assert.equal(clearPath({ x: 440, y: 780 }, { x: 400, y: 780 }, 10), false);
  assert.equal(
    clearMovementPath({ x: 440, y: 780 }, { x: 400, y: 780 }, 10),
    false,
  );
  const { g, p } = game();
  Object.assign(p, { x: 440, y: 780 });
  movePlayer(g, p, { ...no, x: -1, sprint: true }, 0.35);
  assert.equal(
    p.x,
    440,
    'a large movement step cannot tunnel through the board',
  );
  Object.assign(p, { x: INSTRUCTION_BOARD.x, y: INSTRUCTION_BOARD.y });
  assert.equal(
    clearPath(p, { x: p.x + 20, y: p.y }, 2),
    false,
    'work cannot pass through the prop even for a legacy overlapping player',
  );
  movePlayer(g, p, { ...no, x: 1 }, 0.1);
  assert(
    p.x > INSTRUCTION_BOARD.x && p.x < INSTRUCTION_BOARD.x + 10,
    'legacy overlap escape uses normal bounded movement, not a teleport',
  );
  for (let i = 0; i < 4; i++) movePlayer(g, p, { ...no, x: 1 }, 0.1);
  assert(walkable(p.x, p.y));
});
test('legacy litter and carts embedded in new street props move outside without creating or losing trash', () => {
  const { g, p } = game();
  g.leaves = [
    { id: 3001, x: 416, y: 786, hp: 0.43, kind: 2, zone: 0 },
    { id: 3002, x: 144, y: 246, hp: 0.7, kind: 1, zone: 1 },
    { id: 3003, x: 100, y: 100, hp: 0.2, kind: 0, zone: 2 },
  ];
  g.piles = [
    { id: 3004, x: 416, y: 786, amount: 7.123, progress: 0.37, zone: 2 },
  ];
  Object.assign(g.carts[0], {
    x: 416,
    y: 780,
    stored: 12.345,
    owner: p.id,
    face: 0.7,
  });
  p.pushing = g.carts[0].id;
  p.bag = 2.001;
  const beforeMass = mass(g),
    playerPosition = [p.x, p.y];
  const litterFields = (g) =>
    [...g.leaves, ...g.piles].map(({ x, y, ...fields }) => fields);
  const fields = litterFields(g);
  tickWorld(g, g.lastTick); // Existing rooms are repaired through the ordinary shared tick.
  assert.equal(mass(g), beforeMass);
  assert.deepEqual(
    litterFields(g),
    fields,
    'repair preserves IDs, hp, kind, zone, amount and progress',
  );
  assert(walkable(g.leaves[0].x, g.leaves[0].y, 2));
  assert(walkable(g.leaves[1].x, g.leaves[1].y, 2));
  assert.deepEqual(
    [g.leaves[2].x, g.leaves[2].y],
    [100, 100],
    'an unrelated invalid building fixture is not silently relocated',
  );
  assert(walkable(g.piles[0].x, g.piles[0].y, 2));
  assert(walkable(g.carts[0].x, g.carts[0].y, 15));
  assert.equal(g.carts[0].stored, 12.345);
  assert.equal(g.carts[0].face, 0.7);
  assert.equal(g.carts[0].owner, null);
  assert.equal(p.pushing, null);
  assert.deepEqual(
    [p.x, p.y],
    playerPosition,
    'the player is never teleported',
  );
  assert.equal(p.bag, 2.001);
  const repaired = structuredClone(g);
  repairStaticPropOverlaps(g);
  assert.deepEqual(
    g,
    repaired,
    'migration is idempotent after every item has an accessible position',
  );
});
const sql = new DatabaseSync(':memory:');
sql.exec(fs.readFileSync('drizzle/0000_serious_celestials.sql', 'utf8'));
globalThis.__testEnv = {
  DB: {
    prepare(query) {
      return {
        bind(...args) {
          return {
            async first() {
              await Promise.resolve();
              return sql.prepare(query).get(...args) ?? null;
            },
            async run() {
              await Promise.resolve();
              const r = sql.prepare(query).run(...args);
              return { meta: { changes: Number(r.changes) } };
            },
          };
        },
      };
    },
  },
};
compile('app/api/game/route.ts', 'route.mjs', (s) =>
  s
    .replace(
      /import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/u,
      'const env=globalThis.__testEnv;',
    )
    .replace(/(['"])@\/lib\/game\1/u, "'./game.mjs'"),
);
const { POST } = await import(path.join(temp, 'route.mjs'));
const users = Array.from({ length: 9 }, () => ({
  id: crypto.randomUUID(),
  token: crypto.randomUUID(),
}));
async function request(user, action, extra = {}) {
  const res = await POST(
    new Request('https://test.local/api/game', {
      method: 'POST',
      headers: {
        origin: 'https://test.local',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...user, action, name: 'Tester', ...extra }),
    }),
  );
  return { status: res.status, data: await res.json() };
}
test('room API: concurrent 8-player join and inputs, shared 3D posture, session isolation and leave', async () => {
  const made = await request(users[0], 'create', { season: 'rain' });
  assert.equal(made.status, 200);
  const code = made.data.game.code;
  assert(!JSON.stringify(made.data).includes(users[0].token));
  const joined = await Promise.all(
    users.slice(1, 8).map((u) => request(u, 'join', { code })),
  );
  joined.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
  assert.equal((await request(users[8], 'join', { code })).status, 400);
  assert.equal((await request(users[1], 'start', { code })).status, 400);
  const started = await request(users[0], 'start', { code });
  assert.equal(started.data.game.players.length, 8);
  assert.equal(started.data.game.target, 108);
  const frames = await Promise.all(
    users.slice(0, 8).map((u) =>
      request(u, 'input', {
        code,
        round: started.data.game.round,
        seq: 1,
        input: {
          x: 1,
          y: 0,
          work: true,
          crouch: true,
          pitch: -0.8,
          yaw: -1.57,
          tool: 'scoop',
        },
      }),
    ),
  );
  frames.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
  const last = frames.at(-1).data.game;
  assert.equal(
    last.players.filter(
      (p) =>
        p.seq === 1 && p.crouched && p.pitch === -0.8 && p.tool === 'scoop',
    ).length,
    8,
  );
  const spoof = await request({ ...users[1], id: users[0].id }, 'start', {
    code,
  });
  assert.equal(spoof.status, 403);
  const left = await request(users[0], 'leave', { code });
  assert.equal(left.data.game.players.length, 7);
  assert.notEqual(left.data.game.host, users[0].id);
  assert.equal((await request(users[8], 'join', { code })).status, 200);
});
test('API rejects invalid origins, IDs, payloads and unknown rooms', async () => {
  assert.equal(
    (await request(users[0], 'join', { code: 'FFFFFF' })).status,
    404,
  );
  assert.equal(
    (await request({ id: 'x', token: users[0].token }, 'create')).status,
    400,
  );
  const bad = await POST(
    new Request('https://test.local/api/game', {
      method: 'POST',
      headers: { origin: 'https://evil.local' },
      body: '{}',
    }),
  );
  assert.equal(bad.status, 403);
  assert.equal(
    (await request(users[0], 'create', { name: 'a'.repeat(3000) })).status,
    400,
  );
});
test('same-identity rejoin resumes after acknowledged sequence and still rejects old input and round packets', async () => {
  const made = await request(users[0], 'create', { season: 'autumn' });
  const code = made.data.game.code;
  const started = await request(users[0], 'start', { code });
  const round = started.data.game.round;
  const first = await request(users[0], 'input', {
    code,
    round,
    seq: 10000,
    input: { ...no, tool: 'broom' },
  });
  assert.equal(first.status, 200);
  // A leave packet lost in transit leaves this authenticated identity in the room.
  const rejoined = await request(users[0], 'join', { code });
  assert.equal(rejoined.status, 200);
  assert.equal(rejoined.data.game.players[0].seq, 10000);
  const seq = nextInputSequence(rejoined.data.game, users[0].id, 0);
  const fresh = await request(users[0], 'input', {
    code,
    round,
    seq,
    frames: [{ dt: 0, input: { ...no, tool: 'scoop', crouch: true } }],
  });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.data.game.players[0].seq, 10001);
  assert.equal(fresh.data.game.players[0].tool, 'scoop');
  const replay = await request(users[0], 'input', {
    code,
    round,
    seq: 10000,
    frames: [{ dt: 0, input: { ...no, tool: 'broom', grab: true } }],
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.game.players[0].tool, 'scoop');
  assert.equal(mass(replay.data.game), mass(fresh.data.game));
  const wrongRound = await request(users[0], 'input', {
    code,
    round: round - 1,
    seq: 10002,
    frames: [{ dt: 0.1, input: { ...no, x: 1, work: true } }],
  });
  assert.equal(wrongRound.status, 409);
  assert.equal(wrongRound.data.game.players[0].seq, 10001);
});

test('fresh sampled ping, grab and mask survive a one-millisecond server budget deficit exactly once', async () => {
  const originalNow = Date.now;
  let now = 1800000000000;
  Date.now = () => now;
  try {
    const made = await request(users[0], 'create', { season: 'autumn' });
    const code = made.data.game.code;
    const started = await request(users[0], 'start', { code });
    const round = started.data.game.round;
    const history = createInputHistory(100);
    history.sample({ ...no, grab: true, mask: true, ping: true }, 150, true);
    const frames = history.take();
    now += 49;
    const accepted = await request(users[0], 'input', {
      code,
      round,
      seq: 1,
      frames,
    });
    assert.equal(accepted.status, 200);
    const g = accepted.data.game;
    const p = g.players[0];
    assert.equal(
      p.pushing,
      'cart0',
      'the newly sampled grab is at the retained endpoint',
    );
    assert.equal(g.carts[0].owner, p.id);
    assert.equal(
      p.mask,
      22,
      'the fresh mask edge is not mistaken for old held input',
    );
    assert.equal(p.cooldown, 30);
    assert.equal(
      g.pings.length,
      1,
      'a fresh G press cannot disappear due to one millisecond of jitter',
    );
    const ping = structuredClone(g.pings[0]);
    const total = mass(g);
    now += 1;
    const replayed = await request(users[0], 'input', {
      code,
      round,
      seq: 1,
      frames,
    });
    assert.equal(replayed.status, 200);
    assert.equal(
      replayed.data.game.players[0].pushing,
      'cart0',
      'replay must not toggle grab a second time',
    );
    assert.equal(replayed.data.game.players[0].mask, 22);
    assert.equal(replayed.data.game.players[0].cooldown, 30);
    assert.deepEqual(replayed.data.game.pings, [ping]);
    assert.equal(mass(replayed.data.game), total);
  } finally {
    Date.now = originalNow;
  }
});
test('API accepts a coalesced one-second history despite floating point rounding', async () => {
  const made = await request(users[0], 'create', { season: 'autumn' });
  const code = made.data.game.code;
  const started = await request(users[0], 'start', { code });
  const round = started.data.game.round;
  const history = createInputHistory(0);
  for (let i = 1; i <= 20; i++) history.sample(no, i * 50, true);
  const frames = history.take();
  assert.equal(frames.length, 1);
  assert(frames[0].dt > 1 && frames[0].dt < 1 + 1e-6);
  const result = await request(users[0], 'input', {
    code,
    round,
    seq: 1,
    frames,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.game.players[0].seq, 1);
  const tooLong = await request(users[0], 'input', {
    code,
    round,
    seq: 2,
    frames: [{ dt: 1.0001, input: no }],
  });
  assert.equal(
    tooLong.status,
    400,
    'the tolerance cannot expand the history window materially',
  );
});
test('API accepts bounded sampled look history and rejects malformed or oversized history without applying it', async () => {
  const made = await request(users[0], 'create', { season: 'autumn' });
  const code = made.data.game.code;
  const started = await request(users[0], 'start', { code });
  const round = started.data.game.round;
  const frames = Array.from({ length: 20 }, (_, i) => ({
    dt: 0.05,
    input: {
      ...no,
      x: 1,
      yaw: -1.5 + i * 0.01,
      pitch: -0.1 - i * 0.01,
      tool: 'broom',
      grab: false,
      ping: false,
    },
  }));
  const valid = await request(users[0], 'input', {
    code,
    round,
    seq: 1,
    frames,
  });
  assert.equal(
    valid.status,
    200,
    'one second of legitimate 20 Hz look samples must fit the HTTP payload limit',
  );
  for (const frames of [
    [{ dt: -0.1, input: no }],
    [{ dt: null, input: no }],
    [{ dt: 0.1, input: [] }],
    [
      { dt: 0.6, input: no },
      { dt: 0.6, input: no },
    ],
    Array.from({ length: 33 }, () => ({ dt: 0, input: {} })),
  ]) {
    const invalid = await request(users[0], 'input', {
      code,
      round,
      seq: 2,
      frames,
    });
    assert.equal(invalid.status, 400);
    const state = (await request(users[0], 'poll', { code })).data.game;
    assert.equal(
      state.players[0].seq,
      1,
      'rejected history cannot advance authoritative sequence',
    );
    assert.equal(mass(state), mass(valid.data.game));
  }
  const state = (await request(users[0], 'poll', { code })).data.game;
  Object.assign(state.players[0], { working: true, crouched: true, bag: 2 });
  sql
    .prepare('UPDATE rooms SET state=? WHERE code=?')
    .run(JSON.stringify(state), code);
  const beforeMass = mass(state),
    position = [state.players[0].x, state.players[0].y];
  const paused = await request(users[0], 'input', {
    code,
    round,
    seq: 2,
    frames: [],
    input: {
      ...no,
      x: 1,
      work: true,
      grab: true,
      mask: true,
      ping: true,
      tool: 'scoop',
    },
  });
  assert.equal(paused.status, 200);
  const player = paused.data.game.players[0];
  assert.equal(player.working, false);
  assert.equal(player.crouched, false);
  assert.equal(
    player.tool,
    'scoop',
    'pause keeps the selected tool rather than defaulting to broom',
  );
  assert.equal(player.pushing, null);
  assert.equal(player.mask, 0);
  assert.equal(paused.data.game.pings.length, 0);
  assert.deepEqual([player.x, player.y], position);
  assert.equal(mass(paused.data.game), beforeMass);
});
compile('lib/follow-camera.ts', 'follow-camera.mjs', (s) =>
  s.replace(/(['"])\.\/view-controls\1/gu, "'./view-controls.mjs'"),
);
compile('lib/worker-avatar.ts', 'worker-avatar.mjs');
compile('lib/street-materials.ts', 'street-materials.mjs');
compile('lib/street-detail.ts', 'street-detail.mjs');
compile('lib/corner-detail.ts', 'corner-detail.mjs');
compile('lib/scene3d.ts', 'scene3d.mjs', (s) =>
  s.replace(
    /(['"])\.\/(game|street-materials|street-detail|corner-detail|follow-camera|worker-avatar|street-colliders|view-controls)\1/gu,
    (_, _quote, name) => `'./${name}.mjs'`,
  ),
);
const { createWorld } = await import(path.join(temp, 'scene3d.mjs'));
const { createCameraCollision, createFollowCamera } = await import(
  path.join(temp, 'follow-camera.mjs')
);
test('follow camera retracts before walls and overhangs, recovers gradually and never aims backwards', () => {
  const root = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(5, 4, 0.2),
    new THREE.MeshBasicMaterial(),
  );
  wall.position.set(0, 2, 2);
  root.add(wall);
  const collision = createCameraCollision(root),
    follow = createFollowCamera(collision);
  const camera = new THREE.PerspectiveCamera(76, 1.6, 0.04, 130);
  const position = new THREE.Vector3();
  const open = follow.update(camera, position, Math.PI, 0, false, 0.016);
  assert(open.distance > 3);
  const blocked = follow.update(camera, position, 0, 0, false, 0.016);
  assert(
    blocked.distance < 1.75,
    'same-frame retraction keeps the near plane off a wall',
  );
  assert(camera.position.z < 1.68);
  const closeTransport = follow.update(
    camera,
    position,
    0,
    0,
    false,
    0.016,
    true,
  );
  assert(
    closeTransport.distance > 0.78,
    'this fixture keeps a valid compressed camera boom',
  );
  assert.equal(
    closeTransport.avatarVisible,
    false,
    'a compressed transport camera must leave the cart visible',
  );
  const recovering = follow.update(camera, position, Math.PI, 0, false, 0.016);
  assert(
    recovering.distance > blocked.distance &&
      recovering.distance < open.distance,
  );
  for (let i = 0; i < 120; i++)
    follow.update(camera, position, Math.PI, 0, false, 0.016);
  assert(camera.position.distanceTo(new THREE.Vector3(0, 1.24, 0)) > 3);
  // A transformed roof: collision bounds are captured in world space before batching.
  const roofRoot = new THREE.Group(),
    roof = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.12, 5),
      new THREE.MeshBasicMaterial(),
    );
  roofRoot.position.set(10, 0, 0);
  roof.position.y = 2.5;
  roofRoot.add(roof);
  const underRoof = createFollowCamera(createCameraCollision(roofRoot));
  underRoof.update(camera, new THREE.Vector3(10, 0, 0), 0, -0.7, false, 0.016);
  assert(
    camera.position.y < 2.23,
    'camera cannot cross the underside of a canopy',
  );
  const solid = follow.update(
    camera,
    new THREE.Vector3(0, 0, 2),
    0,
    0,
    false,
    0.016,
  );
  assert.equal(solid.distance, 0);
  assert.equal(solid.avatarVisible, false);
  const direction = camera.getWorldDirection(new THREE.Vector3());
  assert(direction.z < 0, 'occlusion never flips the player look direction');
  for (const pitch of [-1.35, 0, 1.35]) {
    underRoof.reset();
    underRoof.update(camera, position, 0, pitch, true, 0.016);
    assert(camera.position.y >= 0.32 - 1e-6);
    assert(camera.position.toArray().every(Number.isFinite));
  }
});
test('visible third-person pitch responds to reversal at both limits and after a first-person extreme', () => {
  const camera = new THREE.PerspectiveCamera(),
    position = new THREE.Vector3(20, 0, 35);
  const follow = createFollowCamera(createCameraCollision(new THREE.Group()));
  const direction = (pitch) => {
    follow.reset();
    follow.update(camera, position, 0, pitch, false, 0.016);
    return camera.getWorldDirection(new THREE.Vector3()).y;
  };
  const top = clampViewPitch(100, 'third'),
    bottom = clampViewPitch(-100, 'third');
  assert(
    direction(clampViewPitch(top - 0.024, 'third')) < direction(top) - 0.01,
  );
  assert(
    direction(clampViewPitch(bottom + 0.024, 'third')) >
      direction(bottom) + 0.005,
  );
  const afterSwitch = clampViewPitch(clampViewPitch(100, 'first'), 'third');
  assert(
    direction(afterSwitch - 0.024) < direction(afterSwitch) - 0.01,
    'a first-person high angle cannot leave invisible overshoot when V selects third-person',
  );
});
const { createWorkerAvatar, animateWorkerAvatar } = await import(
  path.join(temp, 'worker-avatar.mjs')
);
test('full-body worker keeps grips attached, crouches with grounded boots and bounds cosmetic load', () => {
  const model = createWorkerAvatar('#517b65');
  model.position.set(12, 0, 7);
  model.rotation.y = 0.8;
  const base = {
    dt: 0.016,
    time: 1.2,
    speed: 0,
    crouched: false,
    working: false,
    tool: 'broom',
    pushing: false,
    bag: 0,
    mask: false,
  };
  const part = (name) => {
    const object = model.getObjectByName(name);
    assert(object, name);
    return object;
  };
  let poseTime = base.time;
  const settle = (pose, count = 60) => {
    let sample;
    for (let i = 0; i < count; i++) {
      sample = { ...pose, dt: 1 / 60, time: (poseTime += 1 / 60) };
      animateWorkerAvatar(model, sample);
    }
    return sample;
  };
  animateWorkerAvatar(model, base);
  const torsoY = part('worker-torso').position.y;
  const bootY = part('worker-boot-left').position.y;
  let meshes = 0,
    vertices = 0;
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      meshes++;
      vertices += o.geometry.attributes.position.count;
    }
  });
  assert(meshes < 35 && vertices < 20000, 'bounded per-player render rig');
  const poses = [
    base,
    { ...base, speed: 3 },
    { ...base, crouched: true, working: true },
    { ...base, tool: 'scoop', working: true, bag: 8 },
    { ...base, taskKind: 'cart', working: true, bag: 18 },
    { ...base, pushing: true, speed: 1 },
    { ...base, mask: true, bag: 99 },
  ];
  for (const pose of poses) {
    const sample = settle(pose);
    model.updateMatrixWorld(true);
    const matrices = [];
    model.traverse((o) => {
      assert(o.matrixWorld.elements.every(Number.isFinite));
      matrices.push([...o.matrixWorld.elements]);
    });
    animateWorkerAvatar(model, sample);
    model.updateMatrixWorld(true);
    const repeated = [];
    model.traverse((o) => repeated.push([...o.matrixWorld.elements]));
    assert.deepEqual(
      repeated,
      matrices,
      'absolute poses never accumulate drift',
    );
    assert.deepEqual(model.position.toArray(), [12, 0, 7]);
    assert.equal(
      model.rotation.y,
      0.8,
      'animation cannot move or aim the authoritative player',
    );
    if (!pose.pushing) {
      const tool = part(
        pose.taskKind === 'cart' || pose.tool === 'scoop'
          ? 'worker-scoop'
          : 'worker-broom',
      );
      const start = tool.localToWorld(new THREE.Vector3(0, 0, 0)),
        end = tool.localToWorld(new THREE.Vector3(0, 1.2, 0));
      const shaft = new THREE.Line3(start, end);
      for (const side of ['left', 'right']) {
        const hand = part('worker-hand-' + side).getWorldPosition(
          new THREE.Vector3(),
        );
        assert(
          shaft
            .closestPointToPoint(hand, true, new THREE.Vector3())
            .distanceTo(hand) < 0.001,
          'hands stay on the animated shaft',
        );
      }
    }
  }
  settle({ ...base, crouched: true });
  assert(part('worker-torso').position.y < torsoY - 0.2);
  assert(
    Math.abs(part('worker-boot-left').position.y - bootY) < 1e-5,
    'crouch bends joints instead of scaling feet below ground',
  );
  animateWorkerAvatar(model, { ...base, tool: 'scoop', bag: -1 });
  assert.equal(part('worker-scoop-load').count, 0);
  animateWorkerAvatar(model, { ...base, tool: 'scoop', bag: 99, mask: true });
  assert.equal(part('worker-scoop-load').count, 18);
  assert(part('worker-mask').visible);
  settle({ ...base, pushing: true });
  assert(!part('worker-broom').visible && !part('worker-scoop').visible);
  assert(
    Math.abs(part('worker-hand-left').position.z - 0.45) < 1e-5,
    'push grips match the cart handle behind its centre',
  );
});
test('worker crouch transitions and distance-driven strafe gait remain cosmetic and stable at rest', () => {
  const model = createWorkerAvatar('#517b65');
  const torso = model.getObjectByName('worker-torso');
  const foot = model.getObjectByName('worker-boot-left');
  const base = {
    dt: 1 / 60,
    time: 1,
    speed: 0,
    crouched: false,
    working: false,
    tool: 'broom',
    pushing: false,
    bag: 0,
    mask: false,
    movement: { x: 0, z: 1, distance: 0 },
  };
  animateWorkerAvatar(model, base);
  const standing = torso.position.y;
  animateWorkerAvatar(model, { ...base, time: 1 + 1 / 60, crouched: true });
  const firstCrouch = torso.position.y;
  for (let i = 2; i <= 90; i++)
    animateWorkerAvatar(model, { ...base, time: 1 + i / 60, crouched: true });
  assert(
    firstCrouch < standing && firstCrouch > torso.position.y + 0.1,
    'crouch eases toward the grounded pose instead of snapping in one frame',
  );

  for (let i = 1; i <= 180; i++)
    animateWorkerAvatar(model, {
      ...base,
      time: 3 + i / 60,
      speed: 1.5,
      movement: { x: 1.5, z: 0, distance: 0.37 },
    });
  const stationaryDistance = foot.position.clone();
  animateWorkerAvatar(model, {
    ...base,
    time: 6.1,
    speed: 1.5,
    movement: { x: 1.5, z: 0, distance: 0.37 },
  });
  assert(
    foot.position.distanceTo(stationaryDistance) < 1e-8,
    'time passing alone cannot slide the feet through a movement cycle',
  );
  animateWorkerAvatar(model, {
    ...base,
    time: 6.2,
    speed: 1.5,
    movement: { x: 1.5, z: 0, distance: 0.49 },
  });
  assert(
    foot.position.distanceTo(stationaryDistance) > 0.01,
    'actual travelled distance advances a directional walking pose',
  );
  assert.deepEqual(model.position.toArray(), [0, 0, 0]);
  assert.equal(model.rotation.y, 0);
});
test('3D environment constructs valid geometry, camera street view is unobstructed and ground is present', () => {
  const geometryErrors = [];
  const originalError = console.error;
  console.error = (...args) => geometryErrors.push(args.map(String).join(' '));
  let world;
  try {
    world = createWorld();
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(
    geometryErrors,
    [],
    'static batching must not drop incompatible geometry',
  );
  const { scene, lighting, surfaces, cameraCollision } = world;
  assert(cameraCollision.count > 100);
  const follow = createFollowCamera(cameraCollision),
    followView = new THREE.PerspectiveCamera();
  for (const [x, z] of [
    [19, 36.5],
    [6, 29.3],
    [12, 11.8],
    [21, 24],
  ]) {
    for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 4) {
      follow.reset();
      follow.update(
        followView,
        new THREE.Vector3(x, 0, z),
        yaw,
        -0.3,
        false,
        0.016,
      );
      const anchor = new THREE.Vector3(x, 1.24, z);
      assert(
        cameraCollision.fraction(anchor, followView.position) > 0.999,
        'built-street camera segment stays outside solids',
      );
    }
  }
  assert.equal(
    lighting.lights.length,
    4,
    'bounded nearby high-quality light pool',
  );
  assert.equal(
    lighting.emitters.length,
    10,
    'eight street fixtures and two corner emitters share the same four-light pool',
  );
  assert(lighting.lights.every((light) => !light.castShadow && !light.visible));
  assert.equal(surfaces.materials.length, 7);
  assert.equal(
    surfaces.textures.length,
    0,
    'headless Node construction never loads browser assets',
  );
  scene.updateMatrixWorld(true);
  let meshes = 0,
    vertices = 0,
    litRoad = false;
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      meshes++;
      const positions = o.geometry.getAttribute('position');
      vertices += positions.count;
      for (let i = 0; i < positions.array.length; i++)
        assert(Number.isFinite(positions.array[i]));
      if (o.material === surfaces.asphalt) {
        const colors = o.geometry.getAttribute('color');
        litRoad =
          surfaces.asphalt.vertexColors &&
          Array.from(colors.array).some((value) => value > 1.05);
      }
    }
  });
  assert(
    meshes > 20 && meshes < 180,
    'bounded static materials including the café corner',
  );
  assert(vertices > 5000);
  assert(
    litRoad,
    'low quality keeps the soft lamp spill without dynamic lights',
  );
  assert(
    vertices < 260000,
    'small prop bevels must stay within the street geometry budget',
  );
  const ray = new THREE.Raycaster(
    new THREE.Vector3(19, 1.68, 36.5),
    new THREE.Vector3(1, 0, 0),
    0,
    2,
  );
  assert.equal(ray.intersectObjects(scene.children, true).length, 0);
  const ground = new THREE.Raycaster(
    new THREE.Vector3(19, 1.68, 36.5),
    new THREE.Vector3(0, -1, 0),
    0,
    3,
  ).intersectObjects(scene.children, true);
  assert(ground.length > 0);
  assert(ground[0].distance > 1.5);
  console.log(
    '3D world:',
    meshes,
    'static mesh batches,',
    vertices,
    'vertices.',
  );
});
// A conservative walking controller verifies physical access and whole-shift objectives.
function waypoint(p, target, radius = 10) {
  const x = Math.round(p.x / 20),
    y = Math.round(p.y / 20),
    key = (x, y) => x + ',' + y,
    queue = [[x, y]],
    seen = new Set([key(x, y)]),
    prev = new Map();
  let end = null;
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i];
    if (Math.hypot(cx * 20 - target.x, cy * 20 - target.y) < 26) {
      end = [cx, cy];
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx,
        ny = cy + dy,
        k = key(nx, ny);
      if (!seen.has(k) && walkable(nx * 20, ny * 20, radius + 2)) {
        seen.add(k);
        prev.set(k, [cx, cy]);
        queue.push([nx, ny]);
      }
    }
  }
  if (!end) return target;
  let at = end,
    back = prev.get(key(...at));
  while (back && (back[0] !== x || back[1] !== y)) {
    at = back;
    back = prev.get(key(...at));
  }
  return { x: at[0] * 20, y: at[1] * 20 };
}
for (const season of ['autumn', 'rain', 'mixed'])
  test(
    'complete physical sweep → scoop → cart → depot → drains shift: ' + season,
    () => {
      const { g, p } = game(season);
      let target = null,
        deposit = false,
        deliver = false;
      for (let frame = 0; frame < 4800 && g.status === 'playing'; frame++) {
        tickWorld(g, 1000 + (frame + 1) * 100);
        const near = (t) => Math.hypot(t.x - p.x, t.y - p.y),
          cart = g.carts[0];
        let tool = 'broom',
          grab = false;
        const banked =
          g.score + g.carts.reduce((s, c) => s + c.stored, 0) + p.bag;
        if (
          p.bag >= 17 ||
          (banked >= g.target &&
            p.bag > 0 &&
            g.zones.filter((z) => z.completedAt !== null).length >= zoneGoal(g))
        )
          deposit = true;
        if (p.bag === 0) deposit = false;
        if (
          cart.stored >= 30 ||
          (cart.stored > 0 && g.score + cart.stored >= g.target)
        )
          deliver = true;
        if (cart.stored < 0.001) deliver = false;
        if (deliver) {
          if (p.pushing) target = DEPOTS[0];
          else {
            target = cart;
            if (near(cart) < 43) grab = true;
          }
        } else if (p.pushing) {
          grab = true;
          target = DEPOTS[0];
        } else if (
          g.score >= g.target &&
          g.zones.filter((z) => z.completedAt !== null).length >= zoneGoal(g)
        ) {
          tool = 'scoop';
          target = rainy(g)
            ? g.drains
                .filter((d) => d.clog > 0.01)
                .sort((a, b) => near(a) - near(b))[0]
            : null;
        } else if (deposit) {
          target = cart;
        } else {
          const z =
            g.score >= g.target
              ? [...g.zones]
                  .filter((z) => z.completedAt === null)
                  .sort((a, b) => b.picked - a.picked)[0]
              : null;
          const within = (l) => !z || (l.zone ?? zoneAt(g, l).id) === z.id;
          const pile = g.piles
            .filter(within)
            .sort((a, b) => near(a) - near(b))[0];
          if (pile) {
            target = pile;
            tool = 'scoop';
          } else
            target = g.leaves
              .filter(within)
              .sort((a, b) => near(a) - near(b))[0];
        }
        let dx = 0,
          dy = 0;
        if (target && near(target) > (p.pushing ? 28 : 32)) {
          const wp = waypoint(p, target, p.pushing ? 36 : 10);
          dx = wp.x - p.x;
          dy = wp.y - p.y;
        }
        const len = Math.hypot(dx, dy),
          tx = len ? dx : target ? target.x - p.x : 1,
          ty = len ? dy : target ? target.y - p.y : 0;
        const yaw = Math.atan2(-tx, -ty);
        movePlayer(
          g,
          p,
          {
            x: len ? dx / len : 0,
            y: len ? dy / len : 0,
            work: len === 0 && !grab,
            sprint: true,
            mask: p.cooldown <= 0,
            crouch: len === 0 && !p.pushing && !deliver,
            pitch: -0.7,
            yaw,
            tool,
            grab,
          },
          0.1,
        );
      }
      assert.equal(
        g.status,
        'won',
        JSON.stringify({
          season,
          time: g.time,
          score: g.score,
          bag: p.bag,
          cart: g.carts[0],
          drains: g.drains.map((d) => d.clog),
          piles: g.piles.length,
          zones: g.zones.map((z) => [
            z.picked,
            zoneRemaining(g, z),
            z.completedAt,
          ]),
          x: p.x,
          y: p.y,
          target,
        }),
      );
      console.log('Completed', season, 'in', Math.round(g.time), 'seconds');
    },
  );

test('one stroke moves and gathers the forward patch; rear, side and wall remain untouched', () => {
  const { g, p } = leafSetup();
  g.leaves = [
    { id: 1, x: 120, y: 691, hp: 1, kind: 0 },
    { id: 2, x: 133, y: 711, hp: 1, kind: 1 },
    { id: 3, x: 75, y: 700, hp: 1, kind: 1 },
    { id: 4, x: 120, y: 730, hp: 1, kind: 1 },
  ];
  const before = mass(g);
  frames(g, p, { work: true, crouch: true }, 1);
  assert(g.leaves[0].x > 120);
  assert(g.leaves[1].y < 711);
  assert.equal(g.leaves[2].x, 75);
  assert.equal(g.leaves[3].hp, 1);
  frames(g, p, { work: true, crouch: true }, 5);
  assert.equal(g.leaves.length, 2);
  assert.equal(g.piles.length, 1);
  assert.equal(g.piles[0].amount, 2);
  assert.equal(mass(g), before);
  Object.assign(p, { x: 100, y: 380 });
  g.leaves = [{ id: 8, x: 100, y: 408, hp: 1, kind: 0 }];
  frames(g, p, { work: true, crouch: true, yaw: Math.PI }, 15);
  assert.equal(g.leaves[0].hp, 1);
  assert(!clearPath(p, g.leaves[0]));
  Object.assign(p, { x: 100, y: 700 });
  g.piles = [];
  g.leaves = [{ id: 9, x: 101, y: 700, hp: 1, kind: 0 }];
  assert.match(contextHint(g, p), /Lùi nửa bước/);
});
test('opposing sweep and scoop, fractional cart transfers, replays and leaving conserve all trash', () => {
  const { g, p } = leafSetup();
  g.leaves = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    x: 122 + (i % 4) * 2,
    y: 695 + Math.floor(i / 4) * 3,
    hp: 1,
    kind: 0,
  }));
  const b = joinGame(g, 'second-player', 'Bạn', 1000);
  Object.assign(b, { x: 150, y: 700, face: Math.PI });
  const before = mass(g);
  for (let i = 0; i < 30; i++) {
    frames(g, p, { work: true, crouch: true }, 1);
    frames(g, b, { work: true, crouch: true, yaw: Math.PI / 2 }, 1);
    assert.equal(mass(g), before);
  }
  for (let i = 0; i < 60; i++) {
    frames(g, p, { work: true, crouch: true, tool: 'scoop' }, 1);
    frames(
      g,
      b,
      { work: true, crouch: true, tool: 'scoop', yaw: Math.PI / 2 },
      1,
    );
    assert(Math.abs(mass(g) - before) < 1e-6);
  }
  const c = g.carts[0];
  Object.assign(c, { x: 120, y: 700 });
  for (let i = 0; i < 20; i++)
    movePlayer(g, p, { ...no, work: true }, 0.016667);
  assert(Math.abs(mass(g) - before) < 1e-6);
  const bag = b.bag;
  removePlayers(g, (pl) => pl.id === b.id);
  assert.equal(mass(g), before);
  assert(g.piles.some((l) => l.amount === bag));
  assert(c.stored <= 36);
  assert(g.players.every((p) => p.bag <= 18));
});
test('a measured clean zone rests 75 seconds, spawning skips it, and score alone cannot finish', () => {
  const { g, p } = game();
  g.leaves = [];
  g.piles = [{ id: 500, x: 125, y: 700, amount: 9, progress: 0, zone: 0 }];
  Object.assign(p, { x: 100, y: 700 });
  g.score = g.target;
  frames(g, p, { work: true, crouch: true, tool: 'scoop' }, 4);
  assert.equal(g.status, 'playing');
  frames(g, p, { work: true, crouch: true, tool: 'scoop' }, 8);
  assert.equal(g.zones[0].picked, 9);
  assert.equal(zoneRemaining(g, g.zones[0]), 0);
  assert.equal(g.zones[0].completedAt, 0);
  assert.equal(g.zones[0].cleanUntil, 75);
  assert.equal(g.status, 'won');
  addLeaves(g, 100);
  assert(g.leaves.every((l) => l.zone !== 0));
  g.time = 76;
  for (let i = 0; i < 10; i++) addLeaves(g, 10);
  assert(g.leaves.some((l) => l.zone === 0));
});
test('named help/full-cart/clogged-drain pings are bounded, expire, and obey replay protection', () => {
  const { g, p } = game('rain');
  Object.assign(p, { x: 370, y: 700 });
  g.carts[0].stored = 36;
  applyInput(g, p.id, { ...no, ping: true }, 1100, 1);
  assert.equal(g.pings.length, 1);
  assert.equal(g.pings[0].kind, 'cart');
  const expiry = g.pings[0].expiresAt;
  applyInput(g, p.id, { ...no, ping: true }, 1200, 1);
  assert.equal(g.pings[0].expiresAt, expiry);
  g.time = 3;
  Object.assign(p, { x: 170, y: 355 });
  pingAt(g, p);
  assert.equal(g.pings.length, 1);
  assert.equal(g.pings[0].kind, 'drain');
  g.time = 12;
  tickWorld(g, 1300);
  assert.equal(g.pings.length, 0);
});
test('idle network cart is released, contents survive, and onboarding follows a delivery', () => {
  const { g, p } = game();
  Object.assign(p, { x: 370, y: 700 });
  grabCart(g, p);
  g.carts[0].stored = 12;
  releaseOrphanCarts(g, 5001);
  assert.equal(p.pushing, null);
  assert.equal(g.carts[0].owner, null);
  assert.equal(g.carts[0].stored, 12);
  assert.match(onboardingHint(g, p), /^01/);
  p.swept = 1;
  assert.match(onboardingHint(g, p), /^02/);
  p.bag = 3;
  assert.match(onboardingHint(g, p), /^03/);
  p.dumped = 3;
  assert.match(onboardingHint(g, p), /^04/);
  p.score = 1;
  assert.equal(onboardingHint(g, p), null);
});
test('API rejects old formats and old-round inputs and atomically preserves contents on simultaneous work', async () => {
  const made = await request(users[0], 'create', { season: 'autumn' });
  const code = made.data.game.code;
  await request(users[1], 'join', { code });
  const started = await request(users[0], 'start', { code });
  const g = started.data.game;
  g.leaves = [
    { id: 900, x: 125, y: 700, hp: 0.1, kind: 0, zone: 0 },
    { id: 901, x: 130, y: 708, hp: 0.1, kind: 1, zone: 0 },
  ];
  g.players.forEach((p) =>
    Object.assign(p, { x: 100, y: 700, lastInput: Date.now() - 200 }),
  );
  sql
    .prepare('UPDATE rooms SET state=? WHERE code=?')
    .run(JSON.stringify(g), code);
  const sweep = () =>
    Promise.all(
      users.slice(0, 2).map((u) =>
        request(u, 'input', {
          code,
          round: g.round,
          seq: 1,
          input: {
            work: true,
            crouch: true,
            yaw: -Math.PI / 2,
            tool: 'broom',
          },
        }),
      ),
    );
  (await sweep()).forEach((r) => assert.equal(r.status, 200));
  let state = (await request(users[0], 'poll', { code })).data.game;
  assert.equal(mass(state), 2);
  assert.equal(state.leaves.length, 0);
  assert.equal(
    state.piles.reduce((n, p) => n + p.amount, 0),
    2,
  );
  state.players.forEach((p) => (p.lastInput = Date.now() - 350));
  sql
    .prepare('UPDATE rooms SET state=? WHERE code=?')
    .run(JSON.stringify(state), code);
  for (let i = 2; i <= 4; i++) {
    await Promise.all(
      users.slice(0, 2).map((u) =>
        request(u, 'input', {
          code,
          round: g.round,
          seq: i,
          input: {
            work: true,
            crouch: true,
            yaw: -Math.PI / 2,
            tool: 'scoop',
          },
        }),
      ),
    );
    state = (await request(users[0], 'poll', { code })).data.game;
    state.players.forEach((p) => (p.lastInput = Date.now() - 350));
    sql
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run(JSON.stringify(state), code);
  }
  assert.equal(mass(state), 2);
  assert.equal(
    state.players.reduce((n, p) => n + p.bag, 0),
    2,
  );
  await sweep();
  const after = (await request(users[0], 'poll', { code })).data.game;
  assert.equal(mass(after), 2);
  const wrong = await request(users[0], 'input', {
    code,
    round: g.round - 1,
    seq: 100,
    input: { x: 1 },
  });
  assert.equal(wrong.status, 409);
  assert.equal(
    (await request(users[0], 'poll', { code })).data.game.players[0].seq,
    4,
  );
  const left = await request(users[0], 'leave', { code });
  assert.equal(mass(left.data.game), 2);
  after.format = 3;
  sql
    .prepare('UPDATE rooms SET state=? WHERE code=?')
    .run(JSON.stringify(after), code);
  assert.equal((await request(users[1], 'poll', { code })).status, 409);
});

test('large authoritative movement steps cannot tunnel through a tree trunk', () => {
  const { g, p } = game();
  Object.assign(p, { x: 65, y: 605 });
  movePlayer(g, p, { ...no, x: 1, sprint: true }, 0.35);
  assert.equal(p.x, 65);
  assert(walkable(p.x, p.y));
});

test('the last milligram of a bag/cart can be transferred without rounding gain or loss', () => {
  const { g, p } = leafSetup();
  g.leaves = [];
  p.bag = 0.001;
  Object.assign(g.carts[0], { x: 120, y: 700 });
  frames(g, p, { work: true }, 1);
  assert.equal(p.bag, 0);
  assert.equal(g.carts[0].stored, 0.001);
  Object.assign(p, { x: DEPOTS[0].x, y: DEPOTS[0].y + 26, pushing: 'cart0' });
  Object.assign(g.carts[0], { x: p.x, y: p.y - 26, owner: p.id });
  frames(g, p, { work: true, yaw: 0 }, 1);
  assert.equal(g.carts[0].stored, 0);
  assert.equal(g.score, 0.001);
  assert.equal(mass(g), 0.001);
});

test('eight concurrent workers repeatedly sweep, scoop, replay and time out without changing trash mass', async () => {
  const made = await request(users[0], 'create', { season: 'autumn' }),
    code = made.data.game.code;
  await Promise.all(users.slice(1, 8).map((u) => request(u, 'join', { code })));
  let g = (await request(users[0], 'start', { code })).data.game;
  g.spawn = -100; // Disable fresh litter in this conservation fixture.
  g.leaves = Array.from({ length: 32 }, (_, i) => ({
    id: 1000 + i,
    x: 120 + (i % 8),
    y: 692 + Math.floor(i / 8) * 4,
    hp: 1,
    kind: i % 4,
    zone: 0,
  }));
  g.players.forEach((p) =>
    Object.assign(p, { x: 100, y: 700, lastInput: Date.now() - 350 }),
  );
  const save = () =>
    sql
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run(JSON.stringify(g), code);
  save();
  const before = mass(g);
  for (let seq = 1; seq <= 8; seq++) {
    const input = {
      yaw: -Math.PI / 2,
      crouch: true,
      work: true,
      tool: seq <= 2 ? 'broom' : 'scoop',
    };
    const extra = {
      code,
      round: g.round,
      seq,
      input,
      frames: [{ input, dt: 0.35 }],
    };
    const results = await Promise.all(
      users.slice(0, 8).map((u) => request(u, 'input', extra)),
    );
    results.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
    g = (await request(users[0], 'poll', { code })).data.game;
    assert.equal(mass(g), before);
    assert(g.players.every((p) => p.seq === seq && p.bag <= 18));
    await Promise.all(users.slice(0, 8).map((u) => request(u, 'input', extra)));
    g = (await request(users[0], 'poll', { code })).data.game;
    assert.equal(mass(g), before);
    g.players.forEach((p) => (p.lastInput = Date.now() - 350));
    save();
  }
  assert.equal(g.leaves.length, 0);
  assert.equal(g.piles.length, 0);
  assert.equal(
    g.players.reduce((n, p) => n + p.bag, 0),
    32,
  );
  const stale = g.players.find((p) => p.bag >= 3),
    checker = users.find((u) => u.id !== stale.id);
  stale.bag -= 3;
  stale.lastSeen = Date.now() - 30000;
  stale.lastInput = stale.lastSeen;
  stale.pushing = 'cart0';
  Object.assign(g.carts[0], { owner: stale.id, stored: 3 });
  save();
  g = (await request(checker, 'poll', { code })).data.game;
  assert.equal(mass(g), before);
  assert.equal(g.players.length, 7);
  assert.equal(g.carts[0].owner, null);
  assert(g.piles.length > 0);
});
