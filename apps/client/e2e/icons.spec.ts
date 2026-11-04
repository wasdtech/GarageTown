import { expect, type Page, test } from '@playwright/test';
import { open, seedSave } from './helpers';

/** Drawn icons (img.gt-icon) inside a test id, as their file names, and whether all loaded. */
const iconsIn = (page: Page, testid: string) =>
  page.getByTestId(testid).evaluate((el) => {
    // visible icons only (the branch badge is hidden on the first branch)
    const imgs = [...el.querySelectorAll<HTMLImageElement>('img.gt-icon')].filter(
      (i) => i.offsetParent !== null,
    );
    return {
      files: imgs.map((i) => i.getAttribute('src')),
      loaded: imgs.every((i) => i.complete && i.naturalWidth > 0),
    };
  });

test('the menu bar, the HUD and the sound/zoom buttons use drawn icons, not emoji', async ({ page }) => {
  await seedSave(page, { xp: 20, coins: 10 });
  const errors = await open(page);

  await expect
    .poll(() => iconsIn(page, 'menu-bar'))
    .toEqual({
      files: ['ui/car.png', 'ui/dealer.png', 'ui/team.png', 'ui/franchise.png', 'ui/race.png'],
      loaded: true,
    });
  await expect(page.getByTestId('menu-car')).toHaveText('Meu carro');

  await expect
    .poll(() => iconsIn(page, 'hud'))
    .toEqual({ files: ['ui/coin.png', 'ui/star.png'], loaded: true });

  await expect
    .poll(() => iconsIn(page, 'controls'))
    .toEqual({
      files: ['ui/music.png', 'ui/sound.png', 'ui/zoom_in.png', 'ui/zoom_out.png'],
      loaded: true,
    });
  // muting swaps the speaker for the muted one
  await page.getByTestId('mute').click();
  await expect.poll(() => iconsIn(page, 'controls').then((r) => r.files[1])).toBe('ui/sound_off.png');
  expect(errors).toEqual([]);
});
