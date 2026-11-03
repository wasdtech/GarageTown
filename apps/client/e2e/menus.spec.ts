import { expect, test } from '@playwright/test';
import { open, seedSave, tapAnchor } from './helpers';

test('each bottom-bar button opens its own menu; the car menu only configures the car', async ({ page }) => {
  await seedSave(page, { xp: 20, coins: 1000 });
  const errors = await open(page);
  const bar = page.getByTestId('menu-bar');
  await expect(bar).toBeVisible();

  await page.getByTestId('menu-car').click();
  const tabs = await page
    .locator('[data-tab]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')));
  expect(tabs).toEqual(['paint', 'finish', 'extras', 'parts']);
  await expect(page.getByTestId('car-pi')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();

  await page.getByTestId('menu-dealer').click();
  await expect(page.getByTestId('car-pitoco')).toBeVisible();
  await expect(page.locator('[data-tab]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar' }).click();

  await page.getByTestId('menu-team').click();
  await expect(page.getByTestId('hire-ze')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();

  await page.getByTestId('menu-franchise').click();
  await expect(page.getByTestId('open-branch')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();

  // tapping the showcase car still opens the car menu
  await tapAnchor(page, 'showcase');
  await expect(page.getByTestId('car-pi')).toBeVisible();
  expect(errors).toEqual([]);
});
