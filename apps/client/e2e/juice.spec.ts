import { expect, test } from '@playwright/test';
import { advance, open, startJob, tapAnchor } from './helpers';

test('collecting flies coins to the counter and floats the XP', async ({ page }) => {
  const errors = await open(page);
  await startJob(page, 'bay1', 'wash');
  await advance(page, 30_000);
  await tapAnchor(page, 'bay1', { waitFrames: false });
  await expect(page.locator('.gt-coin-fly').first()).toBeAttached();
  await expect(page.locator('.gt-float-text')).toHaveText('+3 XP');
  // effects and toasts must never swallow taps meant for the scene
  for (const sel of ['.gt-coin-fly', '.gt-float-text', '.gt-toasts']) {
    await expect(page.locator(sel).first()).toHaveCSS('pointer-events', 'none');
  }
  await expect(page.locator('.gt-coin-fly')).toHaveCount(0, { timeout: 5_000 });
  expect(errors).toEqual([]);
});

test('the mute choice survives a reload', async ({ page }) => {
  await open(page);
  const mute = page.getByTestId('mute');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await open(page);
  await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'true');
});

test('music and effects toggles are independent and survive a reload', async ({ page }) => {
  await open(page);
  await page.getByTestId('music').click();
  await expect(page.getByTestId('music')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await open(page);
  await expect(page.getByTestId('music')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'false');
});
