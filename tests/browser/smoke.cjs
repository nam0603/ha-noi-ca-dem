// Optional local-only browser playtest. Requires Playwright and Chromium on the executor.
const { chromium } = require('playwright');
let launchedBrowser;
(async () => {
  const browser = (launchedBrowser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  }));
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:5173', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'work/menu.png' });
  console.log(
    JSON.stringify(
      {
        title: await page.title(),
        body: (await page.locator('body').innerText()).slice(0, 4500),
        errors,
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
