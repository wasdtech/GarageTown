import { expect, test } from '@playwright/test';
import { open, startJob, tapAnchor } from './helpers';

test('scrubbing a wash pays the hand bonus', async ({ page }) => {
  const errors = await open(page);
  await startJob(page, 'bay1', 'wash');
  const need = await page.evaluate(() => (window.__gt.store.state.bays[0]!.job as { need: string }).need);
  await tapAnchor(page, 'bay1');
  await page.getByTestId('by-hand').click();
  const box = (await page.getByTestId('scrub').boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < 5_500) {
    const x = box.x + 20 + (i % 2) * (box.width - 40);
    await page.mouse.move(x, box.y + 30 + ((i * 17) % (box.height - 60)), { steps: 4 });
    i++;
  }
  await page.mouse.up();
  await expect(page.getByTestId('coins')).toHaveText(need === 'wash' ? '7' : '6', { timeout: 3_000 });
  expect(errors).toEqual([]);
});
