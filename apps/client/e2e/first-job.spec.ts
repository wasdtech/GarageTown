import { expect, test } from '@playwright/test';
import { advance, open, startJob, tapAnchor } from './helpers';

test('first wash from customer to coins', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByTestId('coins')).toHaveText('0');
  await startJob(page, 'bay1', 'wash');
  await advance(page, 30_000);
  await tapAnchor(page, 'bay1', { waitFrames: false });
  // a quick second tap (~150ms, a human double tap) on the now-empty bay must not show the hint
  await page.waitForTimeout(150);
  await tapAnchor(page, 'bay1');
  await expect(page.getByTestId('xp')).toHaveText('3 XP');
  expect(await page.getByText('Toque num cliente na rua primeiro').count()).toBe(0);
  expect(Number(await page.getByTestId('coins').textContent())).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('hint when tapping a bay with no customer selected', async ({ page }) => {
  await open(page);
  await tapAnchor(page, 'bay1');
  await expect(page.getByText('Toque num cliente na rua primeiro')).toBeVisible();
});

test('zoom buttons change the camera zoom', async ({ page }) => {
  await open(page);
  const zoom = () => page.evaluate(() => window.__gt.scene.cameras.main.zoom);
  const before = await zoom();
  await page.getByRole('button', { name: 'Aproximar' }).click();
  expect(await zoom()).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Afastar' }).click();
  await page.getByRole('button', { name: 'Afastar' }).click();
  expect(await zoom()).toBeLessThan(before);
});
