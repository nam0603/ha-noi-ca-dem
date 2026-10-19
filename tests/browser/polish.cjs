// Optional local 0.7 polish regression. State/GL hooks observe; all play uses shipped inputs.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const THREE = require('three');

const output = 'work/polish-browser';
fs.mkdirSync(output, { recursive: true });
const result = { errors: [], camera: {}, ping: {}, network: {} };
let browser;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function context(
  view = 'third',
  viewport = { width: 960, height: 600 },
  observeGraphics = true,
) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 0.25,
  });
  await ctx.addInitScript(
    ({ view, observeGraphics }) => {
      localStorage.setItem(
        'ca-dem-settings',
        JSON.stringify({
          quality: 'low',
          view,
          sensitivity: 1,
          motion: false,
          fov: 76,
        }),
      );
      // Record matrices sent to the actual WebGL renderer and label canvas drawing.
      window.__polishView = null;
      window.__polishModelViews = {};
      window.__polishFrames = 0;
      window.__polishLabels = [];
      if (observeGraphics) {
        const nativeContext = HTMLCanvasElement.prototype.getContext;
        const hooked = new WeakSet();
        HTMLCanvasElement.prototype.getContext = function (...args) {
          const gl = nativeContext.apply(this, args);
          if (!gl || !String(args[0]).includes('webgl') || hooked.has(gl))
            return gl;
          hooked.add(gl);
          const names = new WeakMap();
          const modelViews = new WeakMap();
          let currentProgram;
          const useProgram = gl.useProgram.bind(gl);
          gl.useProgram = (program) => {
            currentProgram = program;
            return useProgram(program);
          };
          const location = gl.getUniformLocation.bind(gl);
          gl.getUniformLocation = (program, name) => {
            const loc = location(program, name);
            if (loc) names.set(loc, { name, program });
            return loc;
          };
          const matrix = gl.uniformMatrix4fv.bind(gl);
          gl.uniformMatrix4fv = (loc, transpose, value, ...rest) => {
            const uniform = names.get(loc);
            if (uniform?.name === 'viewMatrix')
              window.__polishView = Array.from(value);
            if (uniform?.name === 'modelViewMatrix')
              modelViews.set(uniform.program, Array.from(value));
            return matrix(loc, transpose, value, ...rest);
          };
          for (const method of [
            'drawArrays',
            'drawElements',
            'drawArraysInstanced',
            'drawElementsInstanced',
          ]) {
            const draw = gl[method].bind(gl);
            gl[method] = (...args) => {
              const matrix = currentProgram && modelViews.get(currentProgram);
              if (matrix) {
                const key = matrix.join(',');
                const vote = (window.__polishModelViews[key] ||= {
                  matrix,
                  count: 0,
                });
                vote.count++;
              }
              return draw(...args);
            };
          }
          return gl;
        };
        const text = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (
          value,
          ...rest
        ) {
          window.__polishLabels.push(String(value));
          return text.call(this, value, ...rest);
        };
      }
      function frame() {
        window.__polishFrames++;
        if (observeGraphics) window.__polishModelViews = {};
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    },
    { view, observeGraphics },
  );
  return ctx;
}

async function page(ctx, label) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) =>
    result.errors.push({ kind: 'pageerror', label, message: e.message }),
  );
  p.on('console', (m) => {
    if (m.type() === 'error')
      result.errors.push({
        kind: 'console',
        label,
        message: m.text(),
        url: m.location().url,
        phase: result.network.activePhase || 'none',
      });
  });
  await p.goto(process.env.GAME_URL || 'http://127.0.0.1:5173', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await p.waitForFunction(
    () => !document.querySelector('button.primary')?.disabled,
    null,
    { timeout: 120000 },
  );
  return p;
}
async function selectSeason(p, title) {
  await p.getByRole('button', { name: title }).click();
  await p.waitForFunction(
    (title) =>
      [...document.querySelectorAll('.chapter-picker button')].some(
        (button) =>
          button.classList.contains('selected') &&
          button.textContent.includes(title),
      ),
    title,
    { timeout: 30000 },
  );
}

async function observe(p) {
  await p.evaluate(() => {
    window.__readPolishGame = () => {
      const el = document.querySelector('.fps-app');
      let fiber =
        el[Object.keys(el).find((key) => key.startsWith('__reactFiber'))];
      while (fiber) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next)
          if (hook.memoizedState?.current?.format === 4)
            return hook.memoizedState.current;
        fiber = fiber.return;
      }
      throw Error('Game observation ref missing');
    };
  });
}
const game = (p) => p.evaluate(() => window.__readPolishGame());
const mine = async (p) => (await game(p)).players[0];
async function frames(p, count = 3) {
  const before = await p.evaluate(() => window.__polishFrames);
  await p.waitForFunction(
    ({ before, count }) => window.__polishFrames >= before + count,
    { before, count },
    { timeout: 60000 },
  );
}
async function mouse(p, dx, dy) {
  await p.evaluate(
    ({ dx, dy }) =>
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          movementX: dx,
          movementY: dy,
          bubbles: true,
        }),
      ),
    { dx, dy },
  );
  await frames(p);
}
async function face(p, yaw) {
  const player = await mine(p);
  const previous = Math.atan2(-Math.cos(player.face), -Math.sin(player.face));
  const delta = Math.atan2(Math.sin(yaw - previous), Math.cos(yaw - previous));
  await mouse(p, -delta / 0.002, 0);
}
async function camera(p) {
  const observation = await p.evaluate(() => ({
    rawView: window.__polishView,
    dominant: Object.values(window.__polishModelViews).sort(
      (a, b) => b.count - a.count,
    )[0],
  }));
  // The street batches bake their world transforms into vertices. Their object
  // transforms are identity, so the dominant DRAWN modelView is the camera view.
  // Observing draws also works when low shaders optimize viewMatrix away or the
  // renderer caches uploads after drawing the first-person overlay.
  assert(
    observation.dominant?.count >= 10,
    'Camera observation requires repeated world-batch draws',
  );
  const matrix = new THREE.Matrix4()
    .fromArray(observation.dominant.matrix)
    .invert();
  return {
    observedWorldDraws: observation.dominant.count,
    rawView: observation.rawView,
    position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
    direction: new THREE.Vector3(0, 0, -1).transformDirection(matrix).toArray(),
  };
}
async function viewMode(p, expected) {
  await p.waitForFunction(
    (expected) =>
      JSON.parse(localStorage.getItem('ca-dem-settings')).view === expected &&
      document.querySelector('.reticle')?.hidden === (expected === 'third'),
    expected,
    { timeout: 30000 },
  );
}
async function walkX(p, target) {
  await face(p, -Math.PI / 2);
  await p.keyboard.down('w');
  await p.waitForFunction(
    (target) => {
      if (window.__readPolishGame().players[0].x < target) return false;
      window.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
      );
      return true;
    },
    target,
    { timeout: 60000, polling: 100 },
  );
  await p.keyboard.up('w');
  await frames(p);
}
async function walkForSimulation(p, seconds) {
  const time = (await game(p)).time;
  await p.keyboard.down('w');
  await p.waitForFunction(
    (until) => {
      if (window.__readPolishGame().time < until) return false;
      window.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
      );
      return true;
    },
    time + seconds,
    { timeout: 60000, polling: 100 },
  );
  await p.keyboard.up('w');
  await frames(p, 4);
}

async function visualCases() {
  const ctx = await context();
  const p = await page(ctx, 'solo');
  await p.getByLabel('TÊN TRÊN ÁO').fill('QA polish');
  await selectSeason(p, 'Sau cơn mưa');
  await p.getByRole('button', { name: 'Vào phố · Chơi một mình' }).click();
  await observe(p);
  assert.equal((await game(p)).season, 'rain');
  await frames(p, 4);

  await mouse(p, 0, -2000);
  const upper = await camera(p);
  await mouse(p, 0, 12);
  const upperReverse = await camera(p);
  assert(
    upperReverse.direction[1] < upper.direction[1] - 0.01,
    'Third-person camera must respond immediately when reversing from its upper limit',
  );
  await mouse(p, 0, 2000);
  const lower = await camera(p);
  await mouse(p, 0, -12);
  const lowerReverse = await camera(p);
  assert(
    lowerReverse.direction[1] > lower.direction[1] + 0.005,
    'Third-person camera must respond immediately when reversing from its lower limit',
  );
  result.camera = { upper, upperReverse, lower, lowerReverse };
  // V also normalizes the stored angle after a first-person extreme.
  await p.keyboard.press('v');
  await viewMode(p, 'first');
  await mouse(p, 0, -2000);
  await p.keyboard.press('v');
  await viewMode(p, 'third');
  await frames(p);
  const switched = await camera(p);
  await mouse(p, 0, 12);
  const switchedReverse = await camera(p);
  Object.assign(result.camera, { switched, switchedReverse });
  assert(
    switchedReverse.direction[1] < switched.direction[1] - 0.01,
    'Switching to third-person cannot retain hidden first-person angle overshoot',
  );

  // Reset aim by input, not by writing the game or camera state.
  const player = await mine(p);
  await mouse(p, 0, (player.pitch + 0.05) / 0.002);
  // Approach the old camera-collapse board location by normal walking. The board
  // now has the same coarse footprint for client/server movement and rendering.
  await walkX(p, 440);
  await face(p, -Math.PI);
  await p.keyboard.down('w');
  await p.waitForFunction(
    () => {
      if (window.__readPolishGame().players[0].y < 778) return false;
      window.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
      );
      return true;
    },
    null,
    { timeout: 60000, polling: 100 },
  );
  await p.keyboard.up('w');
  await face(p, Math.PI / 2);
  await walkForSimulation(p, 1);
  const atBoard = await mine(p),
    boardCamera = await camera(p);
  assert(
    atBoard.x >= 427 - 1e-6,
    'The worker must stop outside the instruction board instead of entering the camera collider',
  );
  const boom = new THREE.Vector3(...boardCamera.position).distanceTo(
    new THREE.Vector3(atBoard.x * 0.05, 1.24, atBoard.y * 0.05),
  );
  assert(
    boom > 0.78,
    'The camera and local body cannot collapse when approaching the board',
  );
  result.camera.board = {
    player: { x: atBoard.x, y: atBoard.y },
    camera: boardCamera,
    boom,
  };
  await p.screenshot({
    path: `${output}/instruction-board.png`,
    timeout: 120000,
  });
  await face(p, 0); // Return to the clear working lane before checking the drain ping.
  await p.keyboard.down('w');
  await p.waitForFunction(
    () => {
      if (window.__readPolishGame().players[0].y > 732) return false;
      window.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
      );
      return true;
    },
    null,
    { timeout: 60000, polling: 100 },
  );
  await p.keyboard.up('w');
  await walkX(p, 540);
  await p.keyboard.press('g');
  await p.waitForFunction(
    () => window.__readPolishGame().pings[0]?.kind === 'help',
    null,
    { timeout: 30000 },
  );
  const helpGame = await game(p);
  const helpTime = helpGame.time,
    helpExpires = helpGame.pings[0].expiresAt;
  await walkX(p, 580);
  await p.waitForFunction(
    (helpTime) => window.__readPolishGame().time >= helpTime + 2.05,
    helpTime,
    { timeout: 30000 },
  );
  assert(
    (await game(p)).time < helpTime + 8,
    'Replacement ping must happen before the previous sprite expires',
  );
  await p.keyboard.press('g');
  await p.waitForFunction(
    () => window.__readPolishGame().pings[0]?.kind === 'drain',
    null,
    { timeout: 30000 },
  );
  await frames(p, 4);
  const replacedGame = await game(p),
    issuedAt = replacedGame.pings[0].expiresAt - 8;
  assert(
    issuedAt < helpExpires,
    'The new caption must replace an existing unexpired ping sprite',
  );
  const labels = await p.evaluate(() =>
    window.__polishLabels.filter((text) => text.includes('QA polish ·')),
  );
  assert(
    labels.some((text) => text.includes('CẦN GIÚP')),
    'The help ping must be drawn into a 3D label canvas',
  );
  assert(
    labels.some((text) => text.includes('CỐNG TẮC')),
    'An existing player ping sprite must redraw when the kind changes',
  );
  result.ping = {
    helpTime,
    helpExpires,
    replacementTime: issuedAt,
    observedAt: replacedGame.time,
    labels,
  };
  await p.screenshot({
    path: `${output}/camera-and-ping.png`,
    timeout: 120000,
  });
  await ctx.close();
  console.log('Camera reversal, camera switch and live 3D ping label passed');
}

function mass(g) {
  return (
    g.leaves.length +
    g.piles.reduce((n, pile) => n + pile.amount, 0) +
    g.players.reduce((n, player) => n + player.bag, 0) +
    g.carts.reduce((n, cart) => n + cart.stored, 0) +
    g.score
  );
}
async function controls(p) {
  const fallback = p.getByRole('button', {
    name: 'Hoặc giữ chuột phải để nhìn',
  });
  if (await fallback.isVisible()) {
    await fallback.click();
    await fallback.waitFor({ state: 'hidden', timeout: 30000 });
  }
  await frames(p, 1);
}
async function until(predicate, timeout, message) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert(
      Date.now() < deadline,
      typeof message === 'function' ? message() : message,
    );
    await delay(50);
  }
}
const neutralPacket = (packet) =>
  packet.action === 'input' &&
  packet.status === 200 &&
  !packet.input?.x &&
  !packet.input?.y &&
  packet.frames?.every((frame) => !frame.x && !frame.y);
function retainedMovement(packets) {
  let expectedX = 0,
    heldSeconds = 0,
    eligiblePackets = 0,
    stalePackets = 0;
  for (const packet of packets) {
    if (packet.action !== 'input' || packet.status !== 200 || !packet.frames)
      continue;
    if (packet.serverGapMs > 1500) {
      stalePackets++;
      continue;
    }
    if (!Number.isFinite(packet.serverGapMs)) continue;
    let budget = Math.min(1, Math.max(0, packet.serverGapMs / 1000));
    let skip = Math.max(
      0,
      packet.frames.reduce((sum, frame) => sum + Math.min(1, frame.dt), 0) -
        budget,
    );
    let held = 0;
    for (const frame of packet.frames) {
      const duration = Math.min(1, frame.dt),
        discarded = Math.min(skip, duration);
      skip -= discarded;
      const applied = Math.min(budget, duration - discarded);
      budget -= applied;
      if (Math.hypot(frame.x, frame.y) > 1e-7 && applied > 1e-7) {
        assert(
          !frame.crouch && !frame.sprint && !frame.work,
          'The fairness fixture must remain an unladen normal walk in the clear autumn lane',
        );
        held += applied;
        expectedX +=
          ((72 * frame.x) / Math.max(1, Math.hypot(frame.x, frame.y))) *
          applied;
      }
    }
    if (held > 0) eligiblePackets++;
    heldSeconds += held;
  }
  return { expectedX, heldSeconds, eligiblePackets, stalePackets };
}
async function networkCases() {
  const networkViewport = { width: 640, height: 480 };
  const ca = await context('third', networkViewport, false),
    cb = await context('first', networkViewport, false);
  console.log('Network: opening two isolated 640×480/DPR 0.25 contexts');
  const a = await page(ca, 'host'),
    b = await page(cb, 'guest');
  console.log('Network: both menu renderers ready');
  const responses = [];
  result.network.responses = responses;
  let dropLeave = false,
    delayed = false,
    delayIndex = 0,
    phase = 'lobby';
  const setPhase = (next) => {
    phase = next;
    result.network.activePhase = next;
  };
  setPhase('lobby');
  const requestMetadata = new WeakMap(),
    previousInput = new Map();
  await a.route('**/api/game', async (route) => {
    const body = route.request().postDataJSON();
    const delayMs =
      delayed && body.action === 'input'
        ? [120, 440, 180, 600][delayIndex++ % 4]
        : 0;
    requestMetadata.set(route.request(), { phase, configuredDelayMs: delayMs });
    if (dropLeave && body.action === 'leave') return route.abort('failed');
    if (delayMs) await delay(delayMs);
    return route.continue();
  });
  a.on('response', async (response) => {
    if (!response.url().endsWith('/api/game')) return;
    try {
      const request = response.request().postDataJSON(),
        data = await response.json();
      const player = data.game?.players.find(
        (player) => player.id === request.id,
      );
      const previous = previousInput.get(request.id);
      const serverGapMs =
        player && previous && player.seq >= previous.seq
          ? Math.max(0, player.lastInput - previous.lastInput)
          : undefined;
      if (
        player &&
        (request.action === 'join' || !previous || player.seq >= previous.seq)
      )
        previousInput.set(request.id, {
          seq: player.seq,
          lastInput: player.lastInput,
        });
      responses.push({
        ...requestMetadata.get(response.request()),
        receivedAt: Date.now(),
        action: request.action,
        inputSeq: request.seq,
        status: response.status(),
        serverSeq: player?.seq,
        serverLastInput: player?.lastInput,
        serverGapMs,
        season: data.game?.season,
        x: player?.x,
        y: player?.y,
        frames: request.frames?.map(({ dt, input }) => ({
          dt,
          x: input.x,
          y: input.y,
          sprint: input.sprint,
          crouch: input.crouch,
          work: input.work,
        })),
        input: request.input
          ? { x: request.input.x, y: request.input.y, work: request.input.work }
          : undefined,
      });
    } catch {}
  });
  await selectSeason(a, 'Mùa lá rụng');
  await a.getByRole('button', { name: 'Tạo phòng · 1–8 người' }).click();
  const code = (await a.locator('.big-code').innerText()).replace(/\s/g, '');
  await observe(a);
  assert.equal(
    (await game(a)).season,
    'autumn',
    'The fixture must confirm the committed season on the server',
  );
  const ownId = (await game(a)).host;
  result.network.ownId = ownId;
  console.log('Network: room created', code);
  await b.getByLabel('Mã phòng', { exact: true }).fill(code);
  await b.getByRole('button', { name: 'Vào phòng', exact: true }).click();
  console.log('Network: guest join submitted');
  await a.getByRole('button', { name: 'Bắt đầu ca · 2/8 người' }).click();
  console.log('Network: two-player shift started');
  await Promise.all(
    [a, b].map(async (p) => {
      await p.locator('.objective-card').waitFor({ timeout: 30000 });
      await observe(p);
      await controls(p);
    }),
  );
  await a.waitForFunction(
    (id) =>
      window.__readPolishGame().players.find((player) => player.id === id)
        ?.seq >= 6,
    ownId,
    { timeout: 30000 },
  );
  const before = (await game(a)).players.find((player) => player.id === ownId);
  assert(before, 'Inconclusive: the owned player expired during browser setup');
  console.log(
    'Network: control capture and initial input acknowledged',
    before.seq,
  );
  setPhase('rejoin');
  dropLeave = true;
  await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'Về đầu phố', exact: true }).click();
  await a.getByLabel('Mã phòng', { exact: true }).fill(code);
  await a.getByRole('button', { name: 'Vào phòng', exact: true }).click();
  await a.locator('.objective-card').waitFor({ timeout: 30000 });
  await controls(a);
  const joinIndex = responses
    .map((response) => response.action)
    .lastIndexOf('join');
  const join = responses[joinIndex];
  await until(
    () =>
      responses
        .slice(joinIndex + 1)
        .some((response) => response.action === 'input'),
    30000,
    'Rejoined client must send a fresh input acknowledgement',
  );
  const firstInput = responses
    .slice(joinIndex + 1)
    .find((response) => response.action === 'input');
  assert(
    firstInput.inputSeq > join.serverSeq,
    'First input after rejoin must continue after the authoritative sequence',
  );
  assert.equal(firstInput.serverSeq, firstInput.inputSeq);
  assert.equal(firstInput.status, 200);
  result.network.rejoin = { beforeSeq: before.seq, join, firstInput };
  await a.keyboard.down('w');
  const movementStarted = Date.now();
  console.log(
    'Rejoined after failed leave; checking immediate input',
    JSON.stringify({ code, beforeSeq: before.seq }),
  );
  try {
    await a.waitForFunction(
      ({ id, x }) =>
        window.__readPolishGame().players.find((player) => player.id === id)
          ?.x >
        x + 5,
      { id: ownId, x: before.x },
      { timeout: 30000 },
    );
  } catch (error) {
    result.network.rejoinFailure = await a.evaluate(() => {
      const el = document.querySelector('.fps-app');
      let fiber =
        el[Object.keys(el).find((key) => key.startsWith('__reactFiber'))];
      const refs = [];
      while (fiber) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const v = hook.memoizedState?.current;
          if (v instanceof Set) refs.push({ keys: [...v] });
          else if (typeof v === 'boolean' || typeof v === 'string')
            refs.push(v);
          else if (v && typeof v === 'object' && 'yaw' in v)
            refs.push({ yaw: v.yaw, pitch: v.pitch });
          else if (v && typeof v === 'object' && 'seq' in v && 'token' in v)
            refs.push({ id: v.id, seq: v.seq, revision: v.revision });
        }
        fiber = fiber.return;
      }
      return {
        game: window.__readPolishGame(),
        refs,
        activeElement: document.activeElement?.tagName,
        fallbackVisible: [...document.querySelectorAll('button')].some(
          (b) =>
            b.textContent.includes('Hoặc giữ chuột phải') &&
            b.getBoundingClientRect().width > 0,
        ),
        text: document.body.innerText.slice(-1800),
      };
    });
    await a.screenshot({
      path: `${output}/rejoin-failure.png`,
      timeout: 120000,
    });
    const retained = retainedMovement(
      responses.filter((packet) => packet.phase === 'rejoin'),
    );
    result.network.rejoinMovementFailure = retained;
    if (retained.expectedX <= 5)
      throw Error(
        `Inconclusive: browser did not deliver enough non-stale held input within 30 s: ${JSON.stringify(retained)}`,
      );
    throw error;
  }
  await a.keyboard.up('w');
  result.network.rejoin.movement = {
    wallMs: Date.now() - movementStarted,
    ...retainedMovement(
      responses.filter((packet) => packet.phase === 'rejoin'),
    ),
  };
  assert(
    result.network.rejoin.movement.eligiblePackets > 0,
    'Inconclusive: movement was never exercised by a non-stale input packet',
  );

  // Controlled delay/jitter acts on real HTTP requests; the second context still polls.
  setPhase('settle');
  await until(
    () =>
      responses.filter((packet) => packet.phase === 'settle').slice(-2)
        .length === 2 &&
      responses
        .filter((packet) => packet.phase === 'settle')
        .slice(-2)
        .every(neutralPacket),
    30000,
    'Release must be acknowledged before the measured delay scenario',
  );
  const settled = responses
    .filter((packet) => packet.phase === 'settle')
    .at(-1);
  await a.waitForFunction(
    ({ id, seq }) =>
      window.__readPolishGame().players.find((player) => player.id === id)
        ?.seq >= seq,
    { id: ownId, seq: settled.serverSeq },
    { timeout: 30000 },
  );
  const start = await game(a),
    startX = start.players.find((player) => player.id === ownId).x;
  const conservationBase = mass(start);
  console.log('Network: applying controlled 120–600 ms request delays');
  delayed = true;
  setPhase('jitter');
  const began = Date.now();
  await a.keyboard.down('w');
  await until(
    () => {
      const packets = responses.filter(
        (packet) => packet.phase === 'jitter' && packet.action === 'input',
      );
      return (
        new Set(packets.map((packet) => packet.configuredDelayMs)).size >= 4 &&
        retainedMovement(packets).heldSeconds >= 1.2
      );
    },
    30000,
    () =>
      `Inconclusive: controlled jitter did not produce four delays and 1.2 s of eligible held input: ${JSON.stringify(retainedMovement(responses.filter((packet) => packet.phase === 'jitter')))}`,
  );
  await a.keyboard.up('w');
  const releaseIndex = responses.length;
  await until(
    () =>
      responses
        .slice(releaseIndex)
        .filter((packet) => packet.phase === 'jitter')
        .slice(-2).length === 2 &&
      responses
        .slice(releaseIndex)
        .filter((packet) => packet.phase === 'jitter')
        .slice(-2)
        .every(neutralPacket),
    30000,
    'The delayed held input and release must drain to neutral acknowledgements',
  );
  delayed = false;
  const finalAcknowledgement = responses
    .filter((packet) => packet.phase === 'jitter' && packet.action === 'input')
    .at(-1);
  await a.waitForFunction(
    ({ id, seq }) =>
      window.__readPolishGame().players.find((player) => player.id === id)
        ?.seq >= seq,
    { id: ownId, seq: finalAcknowledgement.serverSeq },
    { timeout: 30000 },
  );
  const end = await game(a),
    movement = finalAcknowledgement.x - startX;
  const delayedResponses = responses.filter(
    (packet) =>
      packet.phase === 'jitter' &&
      packet.action === 'input' &&
      packet.serverSeq <= finalAcknowledgement.serverSeq,
  );
  assert(
    delayedResponses.length >= 4,
    'The delay scenario must exercise all four configured delays',
  );
  assert(delayedResponses.every((response) => response.status === 200));
  assert(
    delayedResponses.every(
      (packet) =>
        packet.frames.length <= 32 &&
        packet.frames.reduce((sum, frame) => sum + frame.dt, 0) <= 1 + 1e-6,
    ),
  );
  const retained = retainedMovement(delayedResponses);
  assert(retained.heldSeconds >= 1.2);
  assert(
    Math.abs(movement - retained.expectedX) < 1.5,
    `Actual movement ${movement} must match ${retained.expectedX} units from retained authoritative-time input`,
  );
  assert(
    // Neither client works during this movement case, so only successful new
    // leaf spawns allocate IDs. Blocked spawn attempts intentionally add none.
    Math.abs(mass(end) - conservationBase - (end.nextId - start.nextId)) < 1e-6,
    'Delayed packets must preserve trash, including successful timed new leaves',
  );
  result.network.jitter = {
    configuredDelayMs: [120, 440, 180, 600],
    wallMs: Date.now() - began,
    movement,
    retained,
    packets: delayedResponses,
  };

  const hostId = ownId;
  setPhase('outage');
  console.log('Network: delayed movement passed; beginning >25 s host outage');
  await a.keyboard.down('w');
  await frames(a, 1);
  await ca.setOffline(true);
  await a.waitForFunction(
    () =>
      document
        .querySelector('.network-status')
        ?.innerText.includes('Đang nối lại'),
    null,
    { timeout: 15000 },
  );
  await a.keyboard.up('w');
  const expiredAt = Date.now();
  await b.waitForFunction(
    (id) => {
      const g = window.__readPolishGame();
      return !g.players.some((player) => player.id === id) && g.host !== id;
    },
    hostId,
    { timeout: 40000, polling: 200 },
  );
  const whileOffline = await game(b);
  console.log('Network: expired host removed; guest is now host');
  assert.equal(whileOffline.players.length, 1);
  assert.equal(whileOffline.host, whileOffline.players[0].id);
  const expiryResponseIndex = responses.length;
  setPhase('expired');
  await ca.setOffline(false);
  const responseDeadline = Date.now() + 15000;
  while (
    !responses
      .slice(expiryResponseIndex)
      .some((response) => response.status === 403)
  ) {
    assert(
      Date.now() < responseDeadline,
      'Expired identity must receive an explicit room/session error',
    );
    await delay(200);
  }
  result.network.expiryConfirmed = true;
  setPhase('rejoin-after-expiry');
  console.log(
    'Network: expired session returned explicit HTTP 403; manually rejoining',
  );
  await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'Về đầu phố', exact: true }).click();
  await a.getByLabel('Mã phòng', { exact: true }).fill(code);
  await a.getByRole('button', { name: 'Vào phòng', exact: true }).click();
  await a.locator('.objective-card').waitFor({ timeout: 30000 });
  await controls(a);
  await frames(a, 4);
  const restored = (await game(a)).players.find(
    (player) => player.id === hostId,
  );
  assert(
    restored,
    'The same browser identity can manually rejoin after expiry',
  );
  const stableX = restored.x;
  await delay(1000);
  const idle = (await game(a)).players.find((player) => player.id === hostId);
  assert(
    Math.abs(idle.x - stableX) < 2,
    'manual rejoin must discard pre-outage held movement',
  );
  await a.keyboard.down('w');
  const recoveredMovementStarted = Date.now();
  await a.waitForFunction(
    ({ id, x }) =>
      window.__readPolishGame().players.find((player) => player.id === id)?.x >
      x + 5,
    { id: hostId, x: stableX },
    { timeout: 30000 },
  );
  await a.keyboard.up('w');
  result.network.outage = {
    offlineObservedMs: Date.now() - expiredAt,
    newHostId: whileOffline.host,
    sameIdentity: restored.id === hostId,
    idleX: idle.x,
    stableX,
    movedX: (await game(a)).players.find((player) => player.id === hostId).x,
    recoveredMovement: {
      wallMs: Date.now() - recoveredMovementStarted,
      ...retainedMovement(
        responses.filter((packet) => packet.phase === 'rejoin-after-expiry'),
      ),
    },
  };
  assert(
    result.network.outage.recoveredMovement.eligiblePackets > 0,
    'Recovery must exercise a fresh non-stale movement packet, not just acknowledge the session',
  );
  await Promise.all([ca.close(), cb.close()]);
  console.log(
    'Failed leave/rejoin, controlled latency/jitter, >25 s expiry, host transfer and manual recovery passed',
  );
}

(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });
  const scenario = process.env.POLISH_SCENARIO || 'all';
  if (scenario !== 'network') await visualCases();
  if (scenario !== 'visual') await networkCases();
  const runtimeErrors = result.errors.filter((error) => {
    // Page exceptions and asset failures are never excused by a network scenario.
    if (error.kind !== 'console' || error.label !== 'host') return true;
    let api = false;
    try {
      api = new URL(error.url).pathname === '/api/game';
    } catch {}
    const intentional = [
      'rejoin',
      'outage',
      'expired',
      'rejoin-after-expiry',
    ].includes(error.phase);
    const offline =
      error.message.includes('ERR_INTERNET_DISCONNECTED') ||
      error.message.includes('ERR_FAILED') ||
      error.message.includes('Failed to fetch');
    const expired =
      result.network.expiryConfirmed &&
      ['expired', 'rejoin-after-expiry'].includes(error.phase) &&
      error.message.includes('status of 403');
    return !(api && intentional && (offline || expired));
  });
  result.runtimeErrors = runtimeErrors;
  result.expectedNetworkErrors = result.errors.filter(
    (error) => !runtimeErrors.includes(error),
  );
  assert.equal(runtimeErrors.length, 0, JSON.stringify(runtimeErrors));
  result.conditions = {
    visualViewport: '960×600; 240×150 canvas at DPR 0.25',
    networkViewport: '640×480; 160×120 canvas at DPR 0.25',
    DPR: 0.25,
    quality: 'low',
    renderer: 'Chromium headless software WebGL',
    scope:
      'State, GL matrix, labels and HTTP fault regression; no claim about real GPU FPS, feel or eight-device stability',
  };
  fs.writeFileSync(
    `${output}/result-${scenario}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log('PASS', JSON.stringify(result));
  await browser.close();
})().catch(async (error) => {
  result.failure = String(error);
  fs.writeFileSync(`${output}/failure.json`, JSON.stringify(result, null, 2));
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
