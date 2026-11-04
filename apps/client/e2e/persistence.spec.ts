import { expect, test } from '@playwright/test';
import { advance, open, startJob, tapAnchor } from './helpers';

test('a running job survives a reload', async ({ page }) => {
  await open(page);
  await startJob(page, 'bay2', 'oil');
  await page.reload();
  const errors = await open(page);
  // the fake-clock offset is lost on reload: the sim rebases timers, so 120s is still enough
  await advance(page, 120_000);
  await tapAnchor(page, 'bay2');
  await expect(page.getByTestId('xp')).toHaveText('12 XP');
  expect(errors).toEqual([]);
});
