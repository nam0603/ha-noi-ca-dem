// Optional local render regression. Uses the shipped menu/settings/input handlers.
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
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      'ca-dem-settings',
      JSON.stringify({
        quality: 'high',
        sensitivity: 1,
        motion: false,
        fov: 76,
      }),
    ),
  );
  const page = await context.newPage(),
    errors = [],
    assets = [],
    fps = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', (response) => {
    if (response.url().includes('/textures/'))
      assets.push({ url: response.url(), status: response.status() });
  });
  await page.goto('http://127.0.0.1:5173', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => !document.querySelector('button.primary')?.disabled,
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'work/visual-menu-high.png', timeout: 120000 });
  console.log('high menu captured');
  await page.getByRole('button', { name: 'Mùa lá rụng' }).click();
  await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).click();
  await page.waitForTimeout(1500);
  const sample = async () =>
    fps.push(
      (await page.locator('.performance').count())
        ? await page.locator('.performance').innerText()
        : (await page.locator('body').innerText()).match(/\d+ FPS/)?.[0],
    );
  await sample();
  await page.screenshot({
    path: 'work/visual-street-high.png',
    timeout: 120000,
  });
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        movementX: 620,
        movementY: -70,
        bubbles: true,
      }),
    ),
  );
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'work/visual-facade-high.png',
    timeout: 120000,
  });
  await page.keyboard.press('2');
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'work/visual-scoop-high.png',
    timeout: 120000,
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cài đặt góc nhìn' }).click();
  await page.getByRole('button', { name: 'Nhẹ · Không bóng' }).click();
  await page.getByRole('button', { name: 'Lưu & trở lại' }).click();
  await page.waitForTimeout(1000);
  await sample();
  await page.screenshot({
    path: 'work/visual-facade-low.png',
    timeout: 120000,
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Về đầu phố', exact: true }).click();
  await page.getByRole('button', { name: 'Sau cơn mưa' }).click();
  await page.getByRole('button', { name: 'Vào phố · Chơi một mình' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'work/visual-rain-low.png', timeout: 120000 });
  const canvas = await page
    .locator('canvas')
    .first()
    .evaluate((c) => ({
      width: c.width,
      height: c.height,
      cssWidth: c.clientWidth,
      cssHeight: c.clientHeight,
    }));
  assert(
    assets.some((a) => a.status === 200),
    'authored texture asset must load',
  );
  assert.equal(
    errors.length,
    0,
    'no geometry merge, shader, runtime or asset errors',
  );
  const result = {
    viewport: '960x600',
    deviceScaleFactor: 1,
    canvas,
    renderer: 'Chromium headless SwiftShader',
    assets,
    fps,
    errors,
  };
  fs.writeFileSync(
    'work/visual-browser-result.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
