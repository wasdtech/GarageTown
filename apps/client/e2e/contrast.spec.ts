import { expect, test } from '@playwright/test';
import { advance, firstCustomer, open, tapAnchor } from './helpers';

// The published page runs with `color-scheme: dark`, where browsers paint button text white by default.
test('menu text stays dark on the light sheet under a dark color scheme', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (document.documentElement.style.colorScheme = 'dark'));
  await advance(page, 20_000);
  await tapAnchor(page, await firstCustomer(page));
  await tapAnchor(page, 'bay1');
  const ink = 'rgb(29, 29, 43)';
  for (const sel of ['.gt-job', '.gt-job[disabled]', '.gt-btn-ghost']) {
    await expect(page.locator(sel).first()).toHaveCSS('color', ink);
  }
});
