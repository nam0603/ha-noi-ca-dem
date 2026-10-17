// Optional local browser check. Observes the React game ref; drives shipped input handlers only.
const { chromium } = require('playwright');
const fs = require('fs'),
  assert = require('assert/strict');
const { pathToFileURL } = require('url');
const path = require('path');
fs.mkdirSync('work', { recursive: true });
let launchedBrowser;
(async () => {
  const { walkable, rainy, zoneGoal, zoneAt, taskAt, DEPOTS } = await import(
    pathToFileURL(path.resolve('.sites-runtime/test-modules/game.mjs'))
  );
  const browser = (launchedBrowser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  }));
  const context = await browser.newContext({
    viewport: { width: 640, height: 480 },
    deviceScaleFactor: 0.25,
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      'ca-dem-settings',
      JSON.stringify({
        quality: 'low',
        sensitivity: 1,
        motion: false,
        fov: 76,
      }),
    ),
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(
    () => !document.querySelector('button.primary')?.disabled,
    null,
    { timeout: 60000 },
  );
  await page.getByRole('button', { name: 'Mùa lá rụng' }).click();
  await page.getByRole('button', { name: 'Ca làm · 8 phút' }).click();
  await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).click();
  await page.evaluate(() => {
    window.testState = () => {
      const el = document.querySelector('.fps-app');
      let f = el[Object.keys(el).find((k) => k.startsWith('__reactFiber'))];
      while (f && f.type?.name !== 'GameClient') f = f.return;
      for (let h = f?.memoizedState; h; h = h.next)
        if (h.memoizedState?.current?.format === 4)
          return h.memoizedState.current;
      throw Error('no game ref');
    };
  });
  function waypoint(p, target, radius) {
    const x = Math.round(p.x / 20),
      y = Math.round(p.y / 20),
      key = (x, y) => x + ',' + y,
      queue = [[x, y]],
      seen = new Set([key(x, y)]),
      prev = new Map();
    let end;
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
  let deposit = false,
    deliver = false,
    g;
  const started = Date.now();
  const fps = [];
  for (let frame = 0; frame < 2600; frame++) {
    g = await page.evaluate(() => window.testState());
    if (g.status !== 'playing') break;
    const p = g.players[0],
      near = (t) => Math.hypot(t.x - p.x, t.y - p.y),
      cart = g.carts[0];
    let target = null,
      tool = 'broom',
      grab = false;
    const banked = g.score + g.carts.reduce((n, c) => n + c.stored, 0) + p.bag,
      clean =
        g.zones.filter((z) => z.completedAt !== null).length >= zoneGoal(g);
    if (p.bag >= 17 || (banked >= g.target && p.bag > 0 && clean))
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
    } else if (g.score >= g.target && clean) {
      tool = 'scoop';
      target = rainy(g)
        ? g.drains
            .filter((d) => d.clog > 0.01)
            .sort((a, b) => near(a) - near(b))[0]
        : null;
    } else if (deposit) target = cart;
    else {
      const z =
          g.score >= g.target
            ? [...g.zones]
                .filter((z) => z.completedAt === null)
                .sort((a, b) => b.picked - a.picked)[0]
            : null,
        within = (l) => !z || (l.zone ?? zoneAt(g, l).id) === z.id;
      const pile = g.piles.filter(within).sort((a, b) => near(a) - near(b))[0];
      if (pile) {
        target = pile;
        tool = 'scoop';
      } else
        target = g.leaves.filter(within).sort((a, b) => near(a) - near(b))[0];
    }
    let dx = 0,
      dy = 0;
    if (target && near(target) > (p.pushing ? 28 : 32)) {
      const wp = waypoint(p, target, p.pushing ? 36 : 10);
      dx = wp.x - p.x;
      dy = wp.y - p.y;
    }
    const back =
      !!target && tool === 'broom' && !deposit && !deliver && near(target) < 16;
    if (back) {
      dx = target.x - p.x || Math.cos(p.face);
      dy = target.y - p.y || Math.sin(p.face);
    }
    const len = Math.hypot(dx, dy),
      tx = len ? dx : target ? target.x - p.x : 1,
      ty = len ? dy : target ? target.y - p.y : 0,
      yaw = Math.atan2(-tx, -ty),
      oldYaw = Math.atan2(-Math.cos(p.face), -Math.sin(p.face)),
      turn = Math.atan2(Math.sin(yaw - oldYaw), Math.cos(yaw - oldYaw));
    await page.evaluate(
      ({ turn, moving, back, work, crouch, tool, grab, mask }) => {
        window.dispatchEvent(
          new MouseEvent('mousemove', {
            movementX: Math.round(-turn / 0.002),
            movementY: 0,
            bubbles: true,
          }),
        );
        const keys = {
          w: moving && !back,
          s: back,
          shift: true,
          e: work,
          c: crouch,
        };
        for (const [key, on] of Object.entries(keys))
          window.dispatchEvent(
            new KeyboardEvent(on ? 'keydown' : 'keyup', { key, bubbles: true }),
          );
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: tool === 'scoop' ? '2' : '1',
            bubbles: true,
          }),
        );
        for (const key of [...(grab ? ['q'] : []), ...(mask ? ['f'] : [])]) {
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true }),
          );
          window.dispatchEvent(
            new KeyboardEvent('keyup', { key, bubbles: true }),
          );
        }
      },
      {
        turn,
        moving: len > 0,
        back,
        work: len === 0 && !grab,
        crouch: len === 0 && !p.pushing && !deliver,
        tool,
        grab,
        mask: p.cooldown <= 0,
      },
    );
    if (frame % 40 === 0) {
      const footer = await page.locator('.game-footer').innerText();
      fps.push(Number(footer.match(/(\d+) FPS/)?.[1]));
      console.log(
        JSON.stringify({
          frame,
          time: Math.round(g.time),
          score: g.score,
          bag: p.bag,
          cart: cart.stored,
          clean: g.zones.map((z) => z.completedAt),
          position: [Math.round(p.x), Math.round(p.y)],
          fps: fps.at(-1),
          target: target && [Math.round(target.x), Math.round(target.y)],
          tool,
          task: taskAt(g, p)?.kind,
          face: p.face,
        }),
      );
    }
    await page.waitForTimeout(100);
  }
  console.log(
    'completed shift',
    JSON.stringify({ status: g.status, time: g.time, score: g.score }),
  );
  assert.equal(
    g.status,
    'won',
    JSON.stringify({
      time: g.time,
      score: g.score,
      zones: g.zones,
      player: g.players[0],
    }),
  );
  await page.getByRole('heading', { name: 'Một góc phố, sạch rồi.' }).waitFor();
  await page.screenshot({ path: 'work/solo-results.png', scale: 'css' });
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.getByRole('button', { name: 'Nhận ca mới', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.testState().status === 'playing' && window.testState().round === 2,
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Về đầu phố', exact: true }).click();
  await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).waitFor();
  const result = {
    result: 'won through UI inputs; result screen; restart; menu',
    simulatedSeconds: g.time,
    wallSeconds: (Date.now() - started) / 1000,
    score: g.score,
    cleanZones: g.zones.filter((z) => z.completedAt !== null).length,
    errors,
    condition:
      'headless Chromium software WebGL; 640x480 CSS; DPR .25; low; synthetic keyboard/mouse events; no state writes',
    fpsSamples: fps,
  };
  fs.writeFileSync(
    'work/browser-full-shift-result.json',
    JSON.stringify(result, null, 2),
  );
  console.log('PASS', JSON.stringify(result));
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  await launchedBrowser?.close();
  process.exitCode = 1;
});
