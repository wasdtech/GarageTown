import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __gt: {
      store: { state: { queue: { id: string }[]; bays: { id: string; job: unknown }[] } };
      scene: { screenOf(id: string): { x: number; y: number } | null };
      clock: { advance(ms: number): void };
    };
  }
}

/** Opens the game, failing the test on any page error. */
export async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => !!window.__gt);
  return errors;
}

export async function advance(page: Page, ms: number) {
  await page.evaluate((m) => window.__gt.clock.advance(m), ms);
}

export async function tapAnchor(page: Page, id: string) {
  const p = await page.evaluate((i) => window.__gt.scene.screenOf(i), id);
  expect(p, `anchor ${id}`).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
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
