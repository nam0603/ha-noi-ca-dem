// Optional local-only browser playtest. Requires Playwright and Chromium on the executor.
const { chromium } = require('playwright'),
  assert = require('assert/strict'),
  fs = require('fs');
require('fs').mkdirSync('work', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let launchedBrowser;
(async () => {
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
  const contexts = await Promise.all([
    browser.newContext({
      viewport: { width: 640, height: 480 },
      deviceScaleFactor: 0.25,
    }),
    browser.newContext({
      viewport: { width: 640, height: 480 },
      deviceScaleFactor: 0.25,
    }),
  ]);
  for (const c of contexts)
    await c.addInitScript(() =>
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
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  let states = [null, null],
    errors = [],
    latency = [],
    statuses = [];
  for (let i = 0; i < 2; i++) {
    pages[i].on('pageerror', (e) => errors.push(e.message));
    pages[i].on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    pages[i].on('response', async (r) => {
      if (r.url().endsWith('/api/game')) {
        statuses.push(r.status());
        try {
          const d = await r.json();
          if (d.game) states[i] = d.game;
          const t = r.request().timing();
          if (t.responseEnd >= 0) latency.push(t.responseEnd);
        } catch {}
      }
    });
  }
  const [a, b] = pages;
  console.log('opened contexts');
  await Promise.all(pages.map((p) => p.goto('http://127.0.0.1:5173')));
  for (const p of pages)
    await p.waitForFunction(
      () => !document.querySelector('button.primary')?.disabled,
      null,
      { timeout: 60000 },
    );
  console.log('menus ready');
  await a.getByRole('button', { name: 'Mùa lá rụng' }).click();
  await a.getByLabel('TÊN TRÊN ÁO').fill('Lan');
  await a.getByRole('button', { name: 'Tạo phòng · 1–8 người' }).click();
  await a.locator('.big-code').waitFor();
  const code = (await a.locator('.big-code').innerText()).trim();
  console.log('room created', code);
  await b.getByLabel('TÊN TRÊN ÁO').fill('Minh');
  await b.getByLabel('Mã phòng', { exact: true }).fill(code);
  await b.getByRole('button', { name: 'Vào phòng', exact: true }).click();
  await a.getByRole('button', { name: 'Bắt đầu ca · 2/8 người' }).waitFor();
  await a.getByRole('button', { name: 'Bắt đầu ca · 2/8 người' }).click();
  for (const p of pages) {
    await p.locator('.objective-card').waitFor({ timeout: 30000 });
    await p
      .getByRole('button', { name: 'Hoặc giữ chuột phải để nhìn' })
      .click();
  }
  async function keys(p, down, up = []) {
    await p.evaluate(
      ({ down, up }) => {
        for (const key of up)
          window.dispatchEvent(
            new KeyboardEvent('keyup', { key, bubbles: true }),
          );
        for (const key of down)
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true }),
          );
      },
      { down, up },
    );
  }
  async function until(pred, timeout = 25000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (pred()) return;
      await sleep(200);
    }
    throw Error(
      'Timed out: ' +
        JSON.stringify(
          states.map(
            (g) =>
              g && {
                status: g.status,
                round: g.round,
                p: g.players.map((p) => ({
                  x: p.x,
                  y: p.y,
                  bag: p.bag,
                  swept: p.swept,
                  seq: p.seq,
                })),
                piles: g.piles,
              },
          ),
        ),
    );
  }
  await until(() =>
    states.every((g) => g?.round === 1 && g.status === 'playing'),
  );
  console.log(
    'joined/start',
    code,
    states.map((g) => g.players.map((p) => p.name)),
  );
  // Camera stays local: one room can mix first/third-person clients.
  await a.keyboard.press('v');
  await a.waitForFunction(
    () => JSON.parse(localStorage.getItem('ca-dem-settings')).view === 'first',
  );
  assert.equal(await a.locator('.reticle').evaluate((el) => el.hidden), false);
  assert.equal(await b.locator('.reticle').evaluate((el) => el.hidden), true);
  console.log('mixed first/third-person cameras in the same room');
  const baseTotal =
    states[0].leaves.length +
    states[0].piles.reduce((n, p) => n + p.amount, 0) +
    states[0].players.reduce((n, p) => n + p.bag, 0);
  const initial = baseTotal - Math.floor(states[0].time / 2.8);
  await Promise.all(pages.map((p) => keys(p, ['c', 'e'])));
  await until(() => states[0].players.some((p) => p.swept > 0));
  await Promise.all(pages.map((p) => keys(p, [], ['e'])));
  console.log(
    'joint sweep',
    states[0].players.map((p) => [p.name, p.swept]),
  );
  await Promise.all(pages.map((p) => keys(p, ['2', 'c', 'e'])));
  await until(() => states[0].players.some((p) => p.bag > 0));
  await Promise.all(pages.map((p) => keys(p, [], ['e', 'c', '2'])));
  await keys(a, ['g']);
  await keys(a, [], ['g']);
  await until(() => states.every((g) => g.pings.length === 1));
  assert.equal(states[0].pings[0].playerId, states[1].pings[0].playerId);
  console.log(
    'shared scoop/ping',
    states[0].players.map((p) => ({ name: p.name, bag: p.bag })),
    states[0].pings,
  );
  // Compare authoritative snapshots by revision-independent conserved total (spawn acknowledged separately).
  const total = (g) =>
    g.leaves.length +
    g.piles.reduce((n, p) => n + p.amount, 0) +
    g.players.reduce((n, p) => n + p.bag, 0) +
    g.carts.reduce((n, c) => n + c.stored, 0) +
    g.score;
  assert(
    Math.abs(
      total(states[0]) - (initial + Math.floor((states[0].time + 1e-8) / 2.8)),
    ) < 1e-6,
    'trash mass differs from initial + timed spawns',
  );
  assert(states[0].players.every((p) => p.bag <= 18));
  await a.screenshot({ path: 'work/co-op-host.png' });
  await b.screenshot({ path: 'work/co-op-guest.png' });
  // Force a real network failure in one context; the other keeps receiving snapshots.
  await keys(a, ['q']);
  await keys(a, [], ['q']);
  await until(() => !!states[0].players[0].pushing);
  await contexts[0].setOffline(true);
  const offlineAt = Date.now();
  const beforeOffline = states[0].players[0].seq;
  await sleep(4100);
  assert(
    (await a.locator('.network-status').innerText()).includes('Đang nối lại'),
  );
  // Release happens on a server request, then must arrive in a browser snapshot.
  // A fixed 4.1 s sleep can inspect the previous response on a busy software GPU.
  await until(() => states[1].carts[0].owner === null, 15000);
  const releaseObservedAfterOfflineMs = Date.now() - offlineAt;
  await contexts[0].setOffline(false);
  await until(() => states[0]?.players[0].seq > beforeOffline);
  await a.waitForFunction(
    () =>
      !document
        .querySelector('.network-status')
        .innerText.includes('Đang nối lại'),
  );
  console.log('disconnect/reconnect passed');
  const runtimeErrors = errors.filter(
    (e) =>
      !e.includes('ERR_INTERNET_DISCONNECTED') &&
      !e.includes('Failed to fetch'),
  );
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join('\n'));
  const sorted = latency.sort((x, y) => x - y);
  const result = {
    room: code,
    contexts: 2,
    quality: 'low',
    viewport: '640x480; DPR 0.25 (160x120 canvas)',
    apiStatuses: [...new Set(statuses)],
    responses: statuses.length,
    latencyMs: {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    },
    expectedOfflineErrors: errors.length,
    releaseObservedAfterOfflineMs,
    runtimeErrors,
    players: states[0].players.map((p) => ({
      name: p.name,
      swept: p.swept,
      picked: p.picked,
      bag: p.bag,
    })),
  };
  fs.writeFileSync(
    'work/browser-coop-result.json',
    JSON.stringify(result, null, 2),
  );
  console.log('PASS', JSON.stringify(result));
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  await launchedBrowser?.close();
  process.exitCode = 1;
});
