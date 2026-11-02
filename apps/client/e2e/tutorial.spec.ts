import { expect, test } from '@playwright/test';
import { advance, firstCustomer, open, tapAnchor } from './helpers';

test('Dona Cida walks a new player through the first job and the garage', async ({ page }) => {
  const errors = await open(page, { tutorial: true });
  const panel = page.getByTestId('tutorial');
  await expect(panel).toContainText('Dona Cida');
  await advance(page, 2_000);
  await tapAnchor(page, await firstCustomer(page));
  await expect(panel).toContainText('toque num box');
  const need = await page.evaluate(
    () =>
      window.__gt.store.state.queue[0]!.id &&
      (window.__gt.store.state.queue[0] as unknown as { need: string }).need,
  );
  const bay = need === 'wash' ? 'bay1' : 'bay2';
  await tapAnchor(page, bay);
  await page.locator(`[data-job="${need}"]`).click();
  await expect(panel).toContainText('Coletar');
  await advance(page, 130_000);
  await tapAnchor(page, bay);
  await expect(panel).toContainText('SEU');
  await tapAnchor(page, 'showcase');
  await expect(panel).toHaveCount(0);
  await page.reload();
  await open(page, { tutorial: true });
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the tutorial can be skipped', async ({ page }) => {
  await open(page, { tutorial: true });
  await page.getByRole('button', { name: 'Pular' }).click();
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
});
