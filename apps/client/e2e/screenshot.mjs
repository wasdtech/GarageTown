// Captures the M0 garage for the owner's style review.
// Usage: node apps/client/e2e/screenshot.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';

const [base = 'http://localhost:4173', out = 'docs/screens'] = process.argv.slice(2);
const now = Date.now();
const save = {
  version: 1,
  coins: 37,
  xp: 24,
  reputation: 3,
  bays: [
    {
      id: 'bay1',
      type: 'wash',
      tile: { x: 2, y: 3 },
      job: {
        jobKey: 'wash',
        customerId: 'c1',
        carKey: 'vespa_gt',
        need: 'wash',
        startedAt: now - 12_000,
        durationS: 30,
      },
    },
    {
      id: 'bay2',
      type: 'mechanic',
      tile: { x: 5, y: 3 },
      job: {
        jobKey: 'oil',
        customerId: 'c2',
        carKey: 'brutus_v8',
        need: 'oil',
        startedAt: now - 200_000,
        durationS: 120,
      },
    },
  ],
  queue: ['kumo_86', 'brutus_v8', 'vespa_gt'].map((carKey, i) => ({
    id: `q${i}`,
    carKey,
    need: i === 1 ? 'oil' : 'wash',
    arrivedAt: now - i * 20_000,
    patienceUntil: now + 100_000 - i * 30_000,
  })),
  nextCustomerAt: now + 60_000,
  lastTickAt: now,
  minigameUses: [],
  rngState: 7,
  nextId: 10,
};
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((s) => localStorage.setItem('gt.save', s), JSON.stringify(save));
  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/m0-garage-${name}.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(name, 'errors:', errors.length ? errors : 'none', 'hscroll:', overflow);
  await page.close();
}
await browser.close();
