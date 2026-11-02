import { expect, test } from '@playwright/test';
import { advance, firstCustomer, open, tapAnchor } from './helpers';

// Regression: clicks on DOM menus must not also reach the game scene underneath.
test.use({ viewport: { width: 1000, height: 640 } });

test('choosing a job in the menu does not tap the scene behind it', async ({ page }) => {
  await open(page);
  await advance(page, 2_000);
  const q = await firstCustomer(page);
  const need = await page.evaluate(
    () => (window.__gt.store.state.queue[0] as unknown as { need: string }).need,
  );
  const bay = need === 'wash' ? 'bay1' : 'bay2';
  await tapAnchor(page, q);
  await tapAnchor(page, bay);
  await page.locator(`[data-job="${need}"]`).click();
  await page.waitForTimeout(300);
  await expect(page.locator('.gt-garage')).toHaveCount(0);
});
