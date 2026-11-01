import { expect, test } from '@playwright/test';
import { advance, open, startJob, tapAnchor } from './helpers';

test('a running job survives a reload', async ({ page }) => {
  await open(page);
  await startJob(page, 'bay2', 'oil');
  await page.reload();
  const errors = await open(page);
  // the fake-clock offset (+20s used to spawn the customer) is lost on reload
  await advance(page, 145_000);
  await tapAnchor(page, 'bay2');
  await expect(page.getByTestId('xp')).toHaveText('6 XP');
  expect(errors).toEqual([]);
});
