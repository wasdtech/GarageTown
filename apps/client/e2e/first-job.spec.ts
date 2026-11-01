import { expect, test } from '@playwright/test';
import { advance, open, startJob, tapAnchor } from './helpers';

test('first wash from customer to coins', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByTestId('coins')).toHaveText('0');
  await startJob(page, 'bay1', 'wash');
  await advance(page, 30_000);
  await tapAnchor(page, 'bay1');
  await expect(page.getByTestId('xp')).toHaveText('3 XP');
  expect(Number(await page.getByTestId('coins').textContent())).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('hint when tapping a bay with no customer selected', async ({ page }) => {
  await open(page);
  await tapAnchor(page, 'bay1');
  await expect(page.getByText('Toque num cliente na rua primeiro')).toBeVisible();
});
