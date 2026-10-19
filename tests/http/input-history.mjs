import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  createInputHistory,
  nextInputSequence,
} from '../../.sites-runtime/test-modules/input-sync.mjs';
import { walkable } from '../../.sites-runtime/test-modules/game.mjs';

// Local Worker/D1 regression only. This script has no external URL override.
// Run from the repository root after npm test and starting local port 5173.
const origin = 'http://127.0.0.1:5173';
fs.mkdirSync('work', { recursive: true });
const result = {
  kind: 'HTTP / local Worker + D1, no browser',
  startedAt: new Date().toISOString(),
  responses: [],
  cadence: [],
  rejoin: {},
  outage: {},
  error: null,
};
const save = () =>
  fs.writeFileSync(
    'work/http-input-history-result.json',
    JSON.stringify(result, null, 2),
  );
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const user = () => ({
  id: crypto.randomUUID(),
  token: crypto.randomUUID(),
  seq: 0,
});
const host = user(),
  guest = user();
let game, code;
const no = {
  x: 0,
  y: 0,
  work: false,
  sprint: false,
  mask: false,
  crouch: false,
  grab: false,
  ping: false,
  tool: 'broom',
  yaw: -Math.PI / 2,
  pitch: 0,
};
const person = (g, u) => g.players.find((p) => p.id === u.id);
const mass = (g) =>
  g.leaves.length +
  g.piles.reduce((n, p) => n + p.amount, 0) +
  g.players.reduce((n, p) => n + p.bag, 0) +
  g.carts.reduce((n, c) => n + c.stored, 0) +
  g.score;
const near = (a, b, label, epsilon = 1e-5) =>
  assert(Math.abs(a - b) < epsilon, `${label}: ${a} != ${b}`);
const pathClear = (a, b) => {
  const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    assert(
      walkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 10),
      'measurement path must be walkable',
    );
  }
};
async function api(u, action, extra = {}, latency = 0) {
  const started = performance.now();
  // Artificial delay on each direction, while the independent sampler keeps running.
  await delay(latency / 2);
  const response = await fetch(`${origin}/api/game`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      action,
      ...u,
      code,
      round: game?.round,
      name: u === host ? 'HTTP host' : 'HTTP guest',
      ...extra,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json();
  await delay(latency / 2);
  const elapsedMs = performance.now() - started;
  result.responses.push({
    action,
    status: response.status,
    elapsedMs,
    artificialLatencyMs: latency,
    playerSeq: data.game ? person(data.game, u)?.seq : undefined,
  });
  if (response.ok) {
    u.seq = nextInputSequence(data.game, u.id, u.seq);
    game = data.game;
    code = game.code;
  }
  return { status: response.status, data, elapsedMs };
}
function conserved(before, after) {
  // This script never works or creates piles: every new ID is a natural leaf spawn.
  near(
    mass(after) - mass(before),
    after.nextId - before.nextId,
    'trash mass plus natural spawning',
  );
  assert(after.players.every((p) => p.bag <= 18));
  assert(after.carts.every((c) => c.stored <= 36));
}
async function packet(u, frames, input = no, latency = 0) {
  const before = structuredClone(game),
    old = person(before, u);
  const seq = u.seq++;
  const response = await api(u, 'input', { frames, input, seq }, latency);
  assert.equal(
    response.status,
    200,
    `input status ${response.status}: ${response.data.error ?? ''}`,
  );
  const current = person(game, u);
  assert.equal(current.seq, seq, 'packet is acknowledged');
  conserved(before, game);
  return {
    before: old,
    after: current,
    response,
    serverGapSec: (current.lastInput - old.lastInput) / 1000,
    seq,
  };
}
async function lane(u) {
  while (Math.abs(person(game, u).y - 750) > 0.01) {
    const p = person(game, u),
      remaining = 750 - p.y;
    const dt = Math.min(0.05, Math.abs(remaining) / 72);
    const input = {
      ...no,
      y: Math.sign(remaining),
      yaw: remaining > 0 ? -Math.PI : 0,
    };
    pathClear(p, { x: p.x, y: p.y + Math.sign(remaining) * 72 * dt });
    await delay(dt * 1000 + 8);
    const ack = await packet(u, [{ input, dt }], input);
    assert(ack.serverGapSec <= 1.5, 'environment stalled during lane setup');
  }
}
let sampling;
try {
  assert.equal(
    (await api(host, 'create', { season: 'autumn', pace: 'relaxed' })).status,
    200,
  );
  assert.equal((await api(guest, 'join')).status, 200);
  assert.equal((await api(host, 'start')).status, 200);
  result.room = code;
  await lane(host);
  const history = createInputHistory(performance.now());
  let held = { ...no, x: 1 };
  sampling = setInterval(
    () => history.sample(held, performance.now(), true),
    50,
  );
  const latencies = [120, 440, 180, 600, 120, 440, 180, 600];
  let expectedTotal = 0,
    actualTotal = 0;
  for (const latency of latencies) {
    const started = performance.now();
    history.sample(held, started, true);
    const frames = history.take();
    const total = frames.reduce((n, f) => n + f.dt, 0);
    const p = person(game, host);
    pathClear(p, { x: p.x + 72 * Math.min(total, 1), y: p.y });
    const ack = await packet(
      host,
      frames.length ? frames : [{ input: no, dt: 0 }],
      held,
      latency,
    );
    assert(
      ack.serverGapSec <= 1.5,
      'environment stalled beyond the history recovery bound',
    );
    const retained = Math.min(total, ack.serverGapSec, 1);
    const moved = ack.after.x - ack.before.x;
    near(moved, 72 * retained, 'HTTP movement uses retained sampled time');
    expectedTotal += 72 * retained;
    actualTotal += moved;
    result.cadence.push({
      latencyMs: latency,
      serverGapSec: ack.serverGapSec,
      historySec: total,
      retainedSec: retained,
      moved,
      expectedMove: 72 * retained,
      ackSeq: ack.seq,
    });
    await delay(Math.max(0, 90 - (performance.now() - started)));
  }
  held = no;
  history.clear(performance.now());
  clearInterval(sampling);
  sampling = undefined;
  await packet(host, [{ input: no, dt: 0 }]);
  result.cadenceSummary = {
    packets: result.cadence.length,
    expectedTotal,
    actualTotal,
    everyPacketApplied: result.cadence
      .filter((row) => row.historySec > 0.01)
      .every((row) => row.moved > 0),
  };
  assert(
    result.cadenceSummary.everyPacketApplied,
    'movement packets really apply',
  );
  console.log('HTTP cadence passed', JSON.stringify(result.cadenceSummary));
  save();

  const serverSeq = person(game, host).seq;
  const oldPosition = { x: person(game, host).x, y: person(game, host).y };
  // The client forgets its counter and omits leave, as a failed leave would do.
  host.seq = 0;
  assert.equal((await api(host, 'join')).status, 200);
  assert.equal(person(game, host).seq, serverSeq);
  assert(host.seq > serverSeq);
  await delay(120);
  const resumed = await packet(host, [{ input: { ...no, x: 1 }, dt: 0.1 }]);
  near(
    resumed.after.x - oldPosition.x,
    7.2,
    'rejoined player moves immediately',
  );
  result.rejoin = {
    skippedLeave: true,
    preservedServerSeq: serverSeq,
    nextSequence: resumed.seq,
    moved: resumed.after.x - oldPosition.x,
  };
  console.log('HTTP failed-leave/rejoin passed', JSON.stringify(result.rejoin));
  save();

  const outageStart = performance.now();
  while (performance.now() - outageStart < 27000) {
    await delay(1000);
    assert.equal((await api(guest, 'poll')).status, 200);
  }
  assert(!person(game, host), 'guest polling expires the silent host');
  assert.equal(game.host, guest.id, 'host transfers to the remaining guest');
  const forbidden = await api(host, 'input', {
    seq: host.seq++,
    frames: [{ input: { ...no, x: 1, work: true }, dt: 1 }],
    input: no,
  });
  assert.equal(forbidden.status, 403);
  result.outage = {
    durationMs: performance.now() - outageStart,
    expiredInputStatus: forbidden.status,
    hostTransferred: true,
  };
  assert.equal((await api(host, 'join')).status, 200);
  const neutral = await packet(host, [], { ...no, tool: 'scoop' });
  near(
    neutral.after.x,
    neutral.before.x,
    'manual rejoin neutral pose does not move',
  );
  assert.equal(neutral.after.tool, 'scoop');
  assert.equal(neutral.after.working, false);
  await lane(host);
  await delay(180);
  const fresh = await packet(host, [{ input: { ...no, x: 1 }, dt: 0.15 }]);
  near(
    fresh.after.x - fresh.before.x,
    10.8,
    'manual rejoin fresh held input works',
  );
  result.outage.manualRejoin = {
    neutral: true,
    tool: neutral.after.tool,
    freshMovement: fresh.after.x - fresh.before.x,
    ackSeq: fresh.seq,
  };
  result.passed = true;
  console.log(
    'HTTP expiry/manual rejoin passed',
    JSON.stringify(result.outage),
  );
} catch (error) {
  result.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (sampling) clearInterval(sampling);
  for (const u of [host, guest]) {
    try {
      if (code) await api(u, 'leave');
    } catch {}
  }
  result.completedAt = new Date().toISOString();
  save();
  console.log(
    'HTTP network result',
    JSON.stringify({
      passed: result.passed ?? false,
      error: result.error,
      responses: result.responses.length,
    }),
  );
}
