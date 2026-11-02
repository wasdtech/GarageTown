import { expect, test } from '@playwright/test';
import { advance, open, seedSave } from './helpers';

test('hire Zé, put him on the wash bay and he works on his own', async ({ page }) => {
  await seedSave(page, { xp: 20, coins: 1000 });
  const errors = await open(page);
  await page.getByTestId('open-garage').click();
  await page.locator('[data-tab="team"]').click();
  await page.getByTestId('hire-ze').click();
  await expect(page.getByTestId('coins')).toHaveText('700');
  await page.getByTestId('assign-ze').selectOption('bay1');
  await page.locator('.gt-garage-sheet .gt-btn-ghost').last().click();
  await advance(page, 5 * 60_000);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window.__gt.store.state as unknown as { idleReport: { jobs: number } }).idleReport.jobs,
      ),
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('coming back after hours shows what the team earned', async ({ page }) => {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 3_600_000;
  await seedSave(page, {
    version: 4,
    xp: 20,
    coins: 0,
    lastTickAt: twoHoursAgo,
    nextCustomerAt: twoHoursAgo + 2_000,
    helpers: [{ key: 'ze', level: 1, bayId: 'bay1' }],
    clockTier: 0,
    lastActiveAt: twoHoursAgo,
    idleReport: { jobs: 0, coins: 0, xp: 0 },
  });
  const errors = await open(page);
  const sheet = page.getByTestId('welcome-back');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Você ficou fora 2h00');
  await page.getByTestId('welcome-collect').click();
  await expect(sheet).toHaveCount(0);
  expect(Number(await page.getByTestId('coins').textContent())).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a level-up earned by a helper is celebrated', async ({ page }) => {
  const now = Date.now();
  await seedSave(page, {
    version: 4,
    xp: 19,
    queue: [{ id: 'w1', carKey: 'pitoco', need: 'wash', arrivedAt: now, patienceUntil: now + 120_000 }],
    nextCustomerAt: now + 3_600_000,
    helpers: [{ key: 'ze', level: 1, bayId: 'bay1' }],
    clockTier: 0,
    lastActiveAt: now,
    idleReport: { jobs: 0, coins: 0, xp: 0 },
  });
  await open(page);
  await advance(page, 31_000);
  await expect(page.getByText('Subiu para o nível 2')).toBeVisible();
});
