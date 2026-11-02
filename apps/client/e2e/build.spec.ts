import { expect, test } from '@playwright/test';
import { advance, open, seedSave, startJob, tapAnchor } from './helpers';

test('build a paint bay, then serve a car in it', async ({ page }) => {
  await seedSave(page, { coins: 500, xp: 130 });
  const errors = await open(page);
  await tapAnchor(page, 'slot-3');
  await page.locator('[data-bay-type="paint"]').click();
  await expect(page.getByText('Obra iniciada')).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText('350');
  await advance(page, 120_000);
  await expect
    .poll(() => page.evaluate(() => window.__gt.store.state.bays.map((b) => b.id)))
    .toContain('bay3');
  await startJob(page, 'bay3', 'touchup');
  await advance(page, 600_000);
  await tapAnchor(page, 'bay3');
  await expect(page.getByTestId('xp')).toHaveText('148 XP');
  expect(errors).toEqual([]);
});
