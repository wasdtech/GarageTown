import { expect, test } from '@playwright/test';

test('a corrupt save is backed up and the game starts fresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('gt.save', '{oops');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');
  await expect(page.getByTestId('coins')).toHaveText('0');
  expect(await page.evaluate(() => localStorage.getItem('gt.save.bak'))).toBe('{oops');
  await expect(page.getByText('Não deu para ler o seu save')).toBeVisible();
  expect(errors).toEqual([]);
});
