import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __gt: {
      store: { state: { queue: { id: string }[]; bays: { id: string; job: unknown }[] } };
      scene: {
        screenOf(id: string): { x: number; y: number } | null;
        cameras: { main: { zoom: number } };
      };
      clock: { advance(ms: number): void };
    };
  }
}

/** Opens the game, failing the test on any page error. */
export async function open(page: Page, opts: { tutorial?: boolean } = {}) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // most specs test other flows; Dona Cida's walkthrough is covered by tutorial.spec
  if (!opts.tutorial) await page.addInitScript(() => localStorage.setItem('gt.tutorial', '4'));
  await page.goto('/');
  await page.waitForFunction(() => !!window.__gt);
  return errors;
}

export async function advance(page: Page, ms: number) {
  await page.evaluate((m) => window.__gt.clock.advance(m), ms);
  await nextFrames(page);
}

export async function tapAnchor(page: Page, id: string, opts: { waitFrames?: boolean } = {}) {
  const p = await page.evaluate((i) => window.__gt.scene.screenOf(i), id);
  expect(p, `anchor ${id}`).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
  if (opts.waitFrames !== false) await nextFrames(page);
}

/** Phaser handles input and makes newly created objects tappable on later frames; wait a few. */
export async function nextFrames(page: Page, n = 3) {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );
}

export async function firstCustomer(page: Page): Promise<string> {
  return page.evaluate(() => window.__gt.store.state.queue[0]!.id);
}

/** Taps the first customer, then the bay, then picks the job. */
export async function startJob(page: Page, bayId: string, jobKey: string) {
  await advance(page, 20_000);
  await tapAnchor(page, await firstCustomer(page));
  await tapAnchor(page, bayId);
  await page.locator(`[data-job="${jobKey}"]`).click();
  await expect
    .poll(() => page.evaluate((b) => !!window.__gt.store.state.bays.find((x) => x.id === b)?.job, bayId))
    .toBe(true);
}

/** Seeds a v3 save before the page loads (only on the first navigation of the test). */
export async function seedSave(page: Page, over: Record<string, unknown>) {
  await page.addInitScript((o) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const now = Date.now();
    const base = {
      version: 3,
      coins: 0,
      xp: 0,
      reputation: 0,
      bays: [
        { id: 'bay1', type: 'wash', tile: { x: 2, y: 3 }, job: null },
        { id: 'bay2', type: 'mechanic', tile: { x: 5, y: 3 }, job: null },
      ],
      queue: [],
      nextCustomerAt: now + 20_000,
      lastTickAt: now,
      minigameUses: [],
      rngState: 3,
      nextId: 1,
      builds: [],
      collection: {
        cars: [
          {
            id: 'car-pitoco',
            model: 'pitoco',
            look: { paint: 'red', finish: 'matte', neon: false, sticker: null },
            parts: {},
          },
        ],
        activeCarId: 'car-pitoco',
        paints: ['red'],
        finishes: ['matte'],
        stickers: [],
        neon: false,
      },
    };
    localStorage.setItem('gt.save', JSON.stringify({ ...base, ...o }));
  }, over);
}
