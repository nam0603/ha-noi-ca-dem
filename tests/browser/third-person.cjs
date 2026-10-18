// Optional local camera regression. Uses shipped UI/input and read-only state observation.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
fs.mkdirSync('work', { recursive: true });
let browser;
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
  const context = await browser.newContext({
    viewport: { width: 960, height: 600 },
    deviceScaleFactor: 0.75,
  });
  // Existing 0.5 preferences lack view. Only seed once so reload tests real persistence.
  await context.addInitScript(() => {
    if (!localStorage.getItem('ca-dem-settings'))
      localStorage.setItem(
        'ca-dem-settings',
        JSON.stringify({
          quality: 'high',
          sensitivity: 1,
          motion: false,
          fov: 76,
        }),
      );
  });
  const page = await context.newPage();
  const errors = [],
    captures = [],
    canvasSizes = {};
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const wait = (predicate) =>
    page.waitForFunction(predicate, null, { timeout: 90000, polling: 200 });
  const capture = async (name) => {
    const path = `work/third-person-${name}.png`;
    await page.screenshot({ path, timeout: 120000 });
    captures.push(path);
    console.log('captured', name);
  };
  const canvasSize = () =>
    page
      .locator('canvas')
      .first()
      .evaluate((canvas) => ({
        width: canvas.width,
        height: canvas.height,
        cssWidth: canvas.clientWidth,
        cssHeight: canvas.clientHeight,
      }));
  const settings = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('ca-dem-settings')));
  const mode = async (view) => {
    await page.waitForFunction(
      (expected) => {
        const saved = JSON.parse(localStorage.getItem('ca-dem-settings'));
        const reticle = document.querySelector('.reticle');
        return (
          saved.view === expected && reticle?.hidden === (expected === 'third')
        );
      },
      view,
      { timeout: 90000 },
    );
  };
  const start = async (season = 'Mùa lá rụng') => {
    await page.waitForFunction(
      () => !document.querySelector('button.primary')?.disabled,
      null,
      { timeout: 120000 },
    );
    await page.getByRole('button', { name: season }).click();
    await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).click();
    await page.evaluate(() => {
      window.testState = () => {
        const el = document.querySelector('.fps-app');
        let fiber =
          el[Object.keys(el).find((key) => key.startsWith('__reactFiber'))];
        while (fiber) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next)
            if (hook.memoizedState?.current?.format === 4)
              return hook.memoizedState.current;
          fiber = fiber.return;
        }
        throw Error('no game ref');
      };
    });
    await wait(() => window.testState().status === 'playing');
  };
  const state = () => page.evaluate(() => window.testState());
  const mine = () => page.evaluate(() => window.testState().players[0]);
  const physicalState = async () => {
    const game = await state(),
      player = game.players[0];
    return {
      format: game.format,
      round: game.round,
      x: player.x,
      y: player.y,
      bag: player.bag,
      tool: player.tool,
      pushing: player.pushing,
      carts: game.carts.map(({ id, x, y, stored, owner }) => ({
        id,
        x,
        y,
        stored,
        owner,
      })),
    };
  };
  const openSettings = async () => {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cài đặt góc nhìn' }).click();
  };
  const leave = async () => {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Về đầu phố', exact: true }).click();
    await page
      .getByRole('button', { name: 'Vào phố · Chơi một mình' })
      .waitFor();
  };
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page
    .locator('.perspective-tag')
    .filter({ hasText: 'GÓC NHÌN THỨ BA' })
    .waitFor();
  await start();
  await page.waitForTimeout(1200);
  assert.equal(
    await page
      .locator('.reticle')
      .evaluate((el) => el.hidden && getComputedStyle(el).display === 'none'),
    true,
  );
  assert.equal(
    await page
      .locator('.touch-actions button')
      .filter({ hasText: /^GÓC NHÌN$/ })
      .count(),
    1,
  );
  canvasSizes.high = await canvasSize();
  await capture('standing-high');

  const beforeToggle = await physicalState();
  await page.keyboard.down('v');
  await mode('first');
  await page.keyboard.down('v'); // Playwright marks a second held keydown as repeat.
  await page.keyboard.down('v');
  await page.waitForTimeout(800);
  await mode('first');
  await page.keyboard.up('v');
  assert.deepEqual(
    await physicalState(),
    beforeToggle,
    'camera toggle must not move players or transfer trash',
  );
  await capture('first-person-high');
  await page.keyboard.press('v');
  await mode('third');

  await page.keyboard.press('2');
  await page.keyboard.down('c');
  await wait(
    () =>
      window.testState().players[0].crouched &&
      window.testState().players[0].tool === 'scoop',
  );
  const beforeCrouchToggle = await physicalState();
  await page.keyboard.press('v');
  await mode('first');
  await page.keyboard.press('v');
  await mode('third');
  await wait(() => window.testState().players[0].crouched);
  assert.deepEqual(
    await physicalState(),
    beforeCrouchToggle,
    'view switch must preserve held crouch, tool and physical state',
  );
  await capture('crouch-high');
  await page.keyboard.up('c');
  await page.keyboard.press('1');
  await wait(
    () =>
      !window.testState().players[0].crouched &&
      window.testState().players[0].tool === 'broom',
  );

  // A short real interaction trip makes work tools/body/cart visible for image inspection.
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
  await capture('sweep-high');
  await page.keyboard.up('e');
  await page.keyboard.press('2');
  await page.keyboard.down('e');
  await wait(() => window.testState().players[0].bag > 0);
  await capture('scoop-high');
  await page.keyboard.up('e');
  await page.keyboard.up('c');
  async function look(yaw) {
    const p = await mine();
    const oldYaw = Math.atan2(-Math.cos(p.face), -Math.sin(p.face));
    const delta = Math.atan2(Math.sin(yaw - oldYaw), Math.cos(yaw - oldYaw));
    await page.evaluate(
      (dx) =>
        window.dispatchEvent(
          new MouseEvent('mousemove', {
            movementX: dx,
            movementY: 0,
            bubbles: true,
          }),
        ),
      -delta / 0.002,
    );
  }
  let p = await mine(),
    cart = (await state()).carts[0];
  await look(Math.atan2(-(cart.x - p.x), -(cart.y - p.y)));
  if (Math.hypot(cart.x - p.x, cart.y - p.y) >= 38) {
    await page.keyboard.down('w');
    await wait(() => {
      const game = window.testState(),
        p = game.players[0],
        cart = game.carts[0];
      if (Math.hypot(cart.x - p.x, cart.y - p.y) >= 35) return false;
      window.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'w', bubbles: true }),
      );
      return true;
    });
    await page.keyboard.up('w');
    p = await mine();
    cart = (await state()).carts[0];
    await look(Math.atan2(-(cart.x - p.x), -(cart.y - p.y)));
  }
  await page.keyboard.down('e');
  await wait(
    () =>
      window.testState().players[0].bag === 0 &&
      window.testState().carts[0].stored > 0,
  );
  await page.keyboard.up('e');
  await page.keyboard.press('q');
  await wait(() => !!window.testState().players[0].pushing);
  await capture('cart-high');

  await openSettings();
  await page
    .getByRole('button', { name: 'Góc nhìn thứ nhất', exact: true })
    .click();
  assert.equal((await settings()).view, 'first');
  assert.match(
    await page
      .getByRole('button', { name: 'Góc nhìn thứ nhất', exact: true })
      .getAttribute('class'),
    /selected/,
  );
  await page
    .getByRole('button', { name: 'Góc nhìn thứ ba', exact: true })
    .click();
  await page.getByRole('button', { name: 'Nhẹ · Không bóng' }).click();
  await page.getByRole('button', { name: 'Lưu & trở lại' }).click();
  await mode('third');
  await page.waitForTimeout(1000);
  canvasSizes.low = await canvasSize();
  await capture('cart-low');
  await leave();
  await page
    .locator('.perspective-tag')
    .filter({ hasText: 'GÓC NHÌN THỨ BA' })
    .waitFor();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page
    .locator('.perspective-tag')
    .filter({ hasText: 'GÓC NHÌN THỨ BA' })
    .waitFor();
  assert.equal((await settings()).quality, 'low');
  await start();
  await page.keyboard.press('v');
  await mode('first');
  await leave();
  await page
    .locator('.perspective-tag')
    .filter({ hasText: 'GÓC NHÌN THỨ NHẤT' })
    .waitFor();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page
    .locator('.perspective-tag')
    .filter({ hasText: 'GÓC NHÌN THỨ NHẤT' })
    .waitFor();
  assert.equal(
    (await settings()).view,
    'first',
    'first-person preference survives reload',
  );
  // The same follow camera/body remains usable in the flooded night scene.
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page
    .getByRole('button', { name: 'Góc nhìn thứ ba', exact: true })
    .click();
  await page.getByRole('button', { name: 'Lưu & trở lại' }).click();
  await start('Sau cơn mưa');
  await mode('third');
  await page.keyboard.down('c');
  await wait(() => window.testState().players[0].crouched);
  assert.equal((await state()).season, 'rain');
  assert((await state()).drains.some((drain) => drain.water > 0));
  await capture('rain-low');
  await page.keyboard.up('c');
  await leave();
  assert.equal(errors.length, 0, errors.join('\n'));
  const result = {
    result:
      'legacy third-person default, keyboard repeat, held crouch/tool, physical state, settings, persistence and work screenshots passed',
    viewport: '960x600',
    deviceScaleFactor: 0.75,
    canvasSizes,
    renderer:
      'Chromium headless software WebGL; images require human inspection',
    captures,
    errors,
  };
  fs.writeFileSync(
    'work/browser-third-person-result.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
