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

test('menus look like a game: a coloured header with icon and close button, pictures on every card', async ({
  page,
}) => {
  await seedSave(page, { xp: 2500, coins: 1000 });
  const errors = await open(page);
  const head = (menu: string) => page.locator(`[data-menu="${menu}"] .gt-sheet-head`);

  for (const menu of ['car', 'dealer', 'team', 'franchise']) {
    await page.getByTestId(`menu-${menu}`).click();
    await expect(head(menu).locator('img.gt-icon')).toBeVisible();
    await expect(head(menu).getByRole('button', { name: 'Fechar' })).toBeVisible();
    // no plain "Fechar" text button at the end of the list any more
    await expect(page.locator('.gt-sheet .gt-btn-ghost', { hasText: 'Fechar' })).toHaveCount(0);
    if (menu === 'dealer') await expect(page.locator('[data-testid="car-pitoco"] canvas')).toBeVisible();
    if (menu === 'team') await expect(page.locator('img[src="ui/helper_ze.png"]').first()).toBeVisible();
    if (menu === 'franchise')
      await expect(page.locator('img[src="ui/perk_lucro.png"]').first()).toBeVisible();
    await head(menu).getByRole('button', { name: 'Fechar' }).click();
  }
  // prices show the drawn coin instead of the emoji
  await page.getByTestId('menu-car').click();
  await expect(page.getByTestId('paint-blue').locator('img.gt-coin')).toBeVisible();
  await expect(page.getByTestId('paint-blue')).not.toContainText('🪙');
  expect(errors).toEqual([]);
});
