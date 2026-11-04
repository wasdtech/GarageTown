import { expect, type Page, test } from '@playwright/test';
import { open, seedSave } from './helpers';

type RaceHook = {
  active: boolean;
  script(p: 'optimal' | 'average' | 'poor'): unknown[];
  run(i: unknown[]): void;
};
const raceHook = (page: Page, profile: 'optimal' | 'poor') =>
  page.evaluate((p) => {
    const r = (window.__gt as unknown as { race: RaceHook }).race;
    r.run(r.script(p));
  }, profile);
const coins = async (page: Page) => Number(await page.getByTestId('coins').textContent());

test('race the first track and win a medal', async ({ page }) => {
  await seedSave(page, { xp: 20, coins: 0 });
  const errors = await open(page);
  await page.getByTestId('menu-race').click();
  await page.getByTestId('race-bairro').click();
  await expect(page.getByTestId('race-hud')).toBeVisible();
  await expect(page.getByTestId('menu-bar')).toBeHidden();
  await raceHook(page, 'optimal');
  await expect(page.getByTestId('race-result')).toBeVisible();
  await expect(page.getByTestId('race-medal')).not.toHaveAttribute('data-medal', 'none');
  await expect.poll(() => coins(page)).toBeGreaterThan(0);
  await page.getByTestId('race-back').click();
  await expect(page.getByTestId('race-hud')).toHaveCount(0);
  await expect(page.getByTestId('menu-bar')).toBeVisible();
  // the next track is open now
  await page.getByTestId('menu-race').click();
  await expect(page.getByTestId('race-avenida')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('the next track is locked until the rival is beaten', async ({ page }) => {
  await seedSave(page, {});
  await open(page);
  await page.getByTestId('menu-race').click();
  await expect(page.getByTestId('race-avenida')).toBeDisabled();
  await expect(page.getByTestId('racha-0')).toBeDisabled();
});

test('a street race takes the stake and pays a win', async ({ page }) => {
  await seedSave(page, {
    version: 6,
    xp: 20,
    coins: 1000,
    helpers: [],
    clockTier: 0,
    lastActiveAt: Date.now(),
    idleReport: { jobs: 0, coins: 0, xp: 0 },
    prestige: { branch: 1, seals: 0, perks: {}, runCoins: 0 },
    race: { medals: { bairro: 1 }, beaten: ['bairro'], rachas: [], count: 0 },
  });
  const errors = await open(page);
  await page.getByTestId('menu-race').click();
  await expect(page.getByTestId('rachas-left')).toHaveText('5 de 5 hoje');
  await page.getByTestId('racha-0').click();
  await raceHook(page, 'optimal');
  await expect(page.getByTestId('race-result')).toBeVisible();
  const won = (await page.getByTestId('race-result').textContent())!.includes('Vitória');
  const stake = Math.floor(50 * (1 + 2 / 5));
  await expect.poll(() => coins(page)).toBe(won ? 1000 + stake : 1000 - stake);
  await page.getByTestId('race-back').click();
  await page.getByTestId('menu-race').click();
  await expect(page.getByTestId('rachas-left')).toHaveText('4 de 5 hoje');
  expect(errors).toEqual([]);
});

test('quitting a street race does not give the stake back', async ({ page }) => {
  await seedSave(page, {
    version: 6,
    xp: 20,
    coins: 1000,
    helpers: [],
    clockTier: 0,
    lastActiveAt: Date.now(),
    idleReport: { jobs: 0, coins: 0, xp: 0 },
    prestige: { branch: 1, seals: 0, perks: {}, runCoins: 0 },
    race: { medals: { bairro: 1 }, beaten: ['bairro'], rachas: [], count: 0 },
  });
  const errors = await open(page);
  const stake = Math.floor(50 * (1 + 2 / 5));
  await page.getByTestId('menu-race').click();
  await page.getByTestId('racha-0').click();
  await expect(page.getByTestId('race-hud')).toBeVisible();
  // the stake is paid at the start
  await expect.poll(() => coins(page)).toBe(1000 - stake);
  await page.getByTestId('race-quit').click();
  await expect(page.getByTestId('race-hud')).toHaveCount(0);
  await expect.poll(() => coins(page)).toBe(1000 - stake);
  await page.getByTestId('menu-race').click();
  await expect(page.getByTestId('rachas-left')).toHaveText('4 de 5 hoje');
  expect(errors).toEqual([]);
});

test('holding and releasing the go button starts the race', async ({ page }) => {
  await seedSave(page, {});
  await open(page);
  await page.getByTestId('menu-race').click();
  await page.getByTestId('race-bairro').click();
  await page.getByTestId('race-go').dispatchEvent('pointerdown');
  await expect(page.locator('[data-lamp="2"]')).toHaveAttribute('data-on', 'green', { timeout: 8000 });
  await page.getByTestId('race-go').dispatchEvent('pointerup');
  await expect(page.getByTestId('race-go')).toHaveText('Trocar marcha');
  await expect
    .poll(async () => parseInt((await page.getByTestId('race-speed').textContent())!, 10))
    .toBeGreaterThan(0);
  await page.getByTestId('race-quit').click();
  await expect(page.getByTestId('race-hud')).toHaveCount(0);
});

test('sliding the finger off the go button before letting go still launches the car', async ({ page }) => {
  await seedSave(page, {});
  await open(page);
  await page.getByTestId('menu-race').click();
  await page.getByTestId('race-bairro').click();
  const b = (await page.getByTestId('race-go').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(page.locator('[data-lamp="2"]')).toHaveAttribute('data-on', 'green', { timeout: 8000 });
  await page.mouse.move(5, 5, { steps: 4 });
  await page.mouse.up();
  // launched by the player, well before the car would leave on its own (2 s after green)
  await expect(page.getByTestId('race-go')).toHaveText('Trocar marcha', { timeout: 1000 });
  await page.getByTestId('race-quit').click();
});

test('"Correr de novo" starts a fresh race on the same track', async ({ page }) => {
  await seedSave(page, { xp: 20, coins: 0 });
  const errors = await open(page);
  await page.getByTestId('menu-race').click();
  await page.getByTestId('race-bairro').click();
  await raceHook(page, 'poor');
  await expect(page.getByTestId('race-result')).toBeVisible();
  await page.getByTestId('race-again').click();
  await expect(page.getByTestId('race-result')).toHaveCount(0);
  await expect(page.getByTestId('race-hud')).toHaveCount(1);
  await expect(page.getByTestId('race-go')).toHaveText('Segure… solte no verde!');
  await expect(page.getByTestId('race-speed')).toHaveText('0 km/h');
  // and it can be finished again
  await raceHook(page, 'optimal');
  await expect(page.getByTestId('race-result')).toBeVisible();
  expect(errors).toEqual([]);
});
