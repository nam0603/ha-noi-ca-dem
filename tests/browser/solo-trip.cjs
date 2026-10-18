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
  const context = await browser.newContext({
    viewport: { width: 640, height: 480 },
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
  await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector('button.primary')?.disabled,
  );
  await page.getByRole('button', { name: 'Mùa lá rụng' }).click();
  await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).click();
  await page.evaluate(() => {
    window.testState = () => {
      const el = document.querySelector('.fps-app');
      let f = el[Object.keys(el).find((k) => k.startsWith('__reactFiber'))];
      // Production minifies component names; observe the ref shape on ancestors.
      while (f) {
        for (let h = f.memoizedState; h; h = h.next)
          if (h.memoizedState?.current?.format === 4)
            return h.memoizedState.current;
        f = f.return;
      }
      throw Error('no game ref');
    };
  });
  const state = () => page.evaluate(() => window.testState());
  const mine = () => page.evaluate(() => window.testState().players[0]);
  const wait = async (pred) => {
    await page.waitForFunction(pred, null, { timeout: 90000, polling: 250 });
  };
  console.log(
    'ready/pointer',
    await page.evaluate(() => ({
      pointer: !!document.pointerLockElement,
      renderer: document
        .querySelector('canvas')
        .getContext('webgl2')
        ?.getParameter(37446),
    })),
  );
  await page.keyboard.down('w');
  await wait(() => {
    if (window.testState().players[0].x < 391) return false;
    window.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
    );
    return true;
  });
  await page.keyboard.up('w');
  await page.keyboard.down('c');
  await page.keyboard.down('e');
  await wait(() => window.testState().players[0].swept > 0);
  await page.keyboard.up('e');
  console.log('swept', await mine());
  await page.keyboard.press('2');
  await page.keyboard.down('e');
  await wait(() => window.testState().players[0].bag > 0);
  await page.keyboard.up('e');
  await page.keyboard.up('c');
  await page.screenshot({ path: 'work/solo-scoop.png' });
  console.log('scoop', await mine());
  // Rotate through the real mouse event handler; do not alter simulation state.
  async function look(yaw, pitch = 0) {
    const p = await mine(),
      oldYaw = Math.atan2(-Math.cos(p.face), -Math.sin(p.face));
    const dyaw = Math.atan2(Math.sin(yaw - oldYaw), Math.cos(yaw - oldYaw));
    await page.evaluate(
      ({ dx, dy }) => {
        window.dispatchEvent(
          new MouseEvent('mousemove', {
            movementX: dx,
            movementY: dy,
            bubbles: true,
          }),
        );
      },
      { dx: -dyaw / 0.002, dy: -(pitch - p.pitch) / 0.002 },
    );
  }
  // Face the nearby cart, dump, then grab and head north toward depot 01.
  let p = await mine(),
    g = await state(),
    c = g.carts[0];
  await look(Math.atan2(-(c.x - p.x), -(c.y - p.y)));
  if (Math.hypot(c.x - p.x, c.y - p.y) >= 38) {
    await page.keyboard.down('w');
    await wait(() => {
      const g = window.testState(),
        p = g.players[0],
        c = g.carts[0];
      if (Math.hypot(c.x - p.x, c.y - p.y) >= 35) return false;
      window.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
      );
      return true;
    });
    await page.keyboard.up('w');
    p = await mine();
    await look(Math.atan2(-(c.x - p.x), -(c.y - p.y)));
  }
  await page.keyboard.down('e');
  await wait(
    () =>
      window.testState().players[0].bag === 0 &&
      window.testState().carts[0].stored > 0,
  );
  await page.keyboard.up('e');
  console.log('dump', await mine());
  await page.keyboard.press('q');
  await wait(() => !!window.testState().players[0].pushing);
  await look(0);
  await page.keyboard.down('w');
  await wait(() => {
    if (Math.abs(window.testState().carts[0].y - 650) >= 42) return false;
    window.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
    );
    return true;
  });
  await page.keyboard.up('w');
  await page.keyboard.down('e');
  await wait(
    () =>
      window.testState().score > 0 && window.testState().carts[0].stored === 0,
  );
  await page.keyboard.up('e');
  console.log('delivered', {
    score: (await state()).score,
    player: await mine(),
  });
  await page.keyboard.press('g');
  await wait(() => window.testState().pings.length > 0);
  await page.keyboard.press('m');
  await page.screenshot({ path: 'work/solo-delivery.png' });
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'q', bubbles: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  });
  await page
    .getByRole('button', { name: 'Tiếp tục ca làm', exact: true })
    .click();
  await page.waitForTimeout(1000);
  assert.equal((await mine()).pushing, 'cart0', 'pause must clear pending Q');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Về đầu phố', exact: true }).click();
  await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'PASS solo sweep/scoop/dump/push/delivery/ping/map/pause/menu; errors',
    errors,
  );
  fs.writeFileSync(
    'work/browser-solo-result.json',
    JSON.stringify(
      {
        errors,
        result: 'one physical delivery completed',
        viewport: '640x480',
        quality: 'low',
        renderer: 'Chromium software WebGL',
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  await launchedBrowser?.close();
  process.exitCode = 1;
});
