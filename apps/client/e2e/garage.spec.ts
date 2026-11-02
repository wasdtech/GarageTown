import { expect, test } from '@playwright/test';
import { open, seedSave, tapAnchor } from './helpers';

test('customise the showcase car: paint and an engine part', async ({ page }) => {
  await seedSave(page, { xp: 20, coins: 1000 });
  const errors = await open(page);
  await tapAnchor(page, 'showcase');
  await expect(page.getByTestId('car-class')).toHaveText('D');
  await expect(page.getByTestId('car-pi')).toHaveText('PI 180');
  await page.getByTestId('paint-blue').click();
  await expect(page.getByTestId('coins')).toHaveText('850');
  await page.locator('[data-tab="parts"]').click();
  await page.getByTestId('part-engine').click();
  await expect(page.getByTestId('coins')).toHaveText('350');
  await expect(page.getByTestId('car-pi')).toHaveText('PI 210');
  await expect(page.getByTestId('car-class')).toHaveText('C');
  expect(errors).toEqual([]);
});

test('the dealership shows locked cars and the garage button opens it', async ({ page }) => {
  await seedSave(page, { xp: 0, coins: 99999 });
  await open(page);
  await page.getByTestId('open-garage').click();
  await page.locator('[data-tab="cars"]').click();
  await expect(page.getByTestId('car-brutus_v8')).toBeDisabled();
  await expect(page.getByTestId('car-brutus_v8')).toContainText('Nível 5');
});
