import { expect, test } from '@playwright/test';
import { open, seedSave } from './helpers';

test('an impatient customer gets angry (once) and the busy garage runs without errors', async ({ page }) => {
  const now = Date.now();
  const job = (jobKey: string, id: string, durationS: number) => ({
    jobKey,
    customerId: id,
    carKey: 'brutus_v8',
    need: jobKey,
    startedAt: now,
    durationS,
  });
  await seedSave(page, {
    xp: 2500,
    bays: [
      { id: 'bay1', type: 'wash', tile: { x: 2, y: 3 }, job: job('wash', 'w', 3000) },
      { id: 'bay2', type: 'mechanic', tile: { x: 5, y: 3 }, job: job('engine', 'm', 3600) },
    ],
    queue: [
      { id: 'calm', carKey: 'pitoco', need: 'wash', arrivedAt: now, patienceUntil: now + 120_000 },
      {
        id: 'angry',
        carKey: 'corisco_rs',
        need: 'oil',
        arrivedAt: now - 100_000,
        patienceUntil: now + 20_000,
      },
    ],
    nextCustomerAt: now + 600_000,
  });
  const errors = await open(page);
  await expect
    .poll(() => page.evaluate(() => [...(window.__gt.scene as unknown as { honked: Set<string> }).honked]))
    .toEqual(['angry']);
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
