import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { open, seedSave } from './helpers';

const content = (f: string) =>
  JSON.parse(readFileSync(new URL(`../../../content/${f}`, import.meta.url), 'utf8'));
const levels: { level: number; xp: number }[] = content('levels.json');
const divisor: number = content('prestige.json').sealDivisor;
const xpFor = (level: number) => levels[level - 1]!.xp;

/** A level-12 garage with a second car, a helper on a bay and 5 seals' worth of coins earned. */
async function seedLateBranch(page: Page, over: Record<string, unknown> = {}) {
  const now = Date.now();
  await seedSave(page, {
    version: 5,
    xp: xpFor(12),
    coins: 5000,
    nextCustomerAt: now + 6_000_000,
    helpers: [{ key: 'ze', level: 1, bayId: 'bay1' }],
    clockTier: 0,
    lastActiveAt: now,
    idleReport: { jobs: 0, coins: 0, xp: 0 },
    collection: {
      cars: [
        {
          id: 'car-pitoco',
          model: 'pitoco',
          look: { paint: 'red', finish: 'matte', neon: false, sticker: null },
          parts: {},
        },
        {
          id: 'car-brutus',
          model: 'brutus_v8',
          look: { paint: 'red', finish: 'matte', neon: false, sticker: null },
          parts: {},
        },
      ],
      activeCarId: 'car-pitoco',
      paints: ['red'],
      finishes: ['matte'],
      stickers: [],
      neon: false,
    },
    prestige: { branch: 1, seals: 0, perks: {}, runCoins: 25 * divisor + 100 },
    ...over,
  });
}

async function openFranchiseTab(page: Page) {
  await page.getByTestId('menu-franchise').click();
}

test('opening a branch resets the garage but keeps the cars', async ({ page }) => {
  await seedLateBranch(page);
  const errors = await open(page);
  await openFranchiseTab(page);
  await expect(page.getByText('Abrir agora: +5 selos')).toBeVisible();
  await page.getByTestId('open-branch').click();
  await page.getByTestId('confirm-branch').click();
  await expect(page.getByTestId('coins')).toHaveText('0');
  await expect(page.getByTestId('level')).toHaveText('1');
  await expect(page.getByTestId('branch')).toHaveText('🏢 2');
  const s = await page.evaluate(() => {
    const st = window.__gt.store.state as unknown as {
      collection: { cars: unknown[] };
      helpers: unknown[];
      bays: unknown[];
      prestige: { seals: number };
    };
    return {
      cars: st.collection.cars.length,
      helpers: st.helpers.length,
      bays: st.bays.length,
      seals: st.prestige.seals,
    };
  });
  expect(s).toEqual({ cars: 2, helpers: 0, bays: 2, seals: 5 });
  await openFranchiseTab(page);
  await expect(page.getByTestId('seals')).toHaveText('🏅 5 selos');
  expect(errors).toEqual([]);
});

test('cancel keeps everything', async ({ page }) => {
  await seedLateBranch(page);
  await open(page);
  await openFranchiseTab(page);
  await page.getByTestId('open-branch').click();
  await page.getByTestId('cancel-branch').click();
  await expect(page.getByTestId('open-branch')).toBeVisible();
  await expect(page.getByTestId('level')).toHaveText('12');
  await expect(page.getByTestId('coins')).not.toHaveText('0');
  await expect(page.getByTestId('branch')).toBeHidden();
});

test('buying a perk raises it', async ({ page }) => {
  await seedLateBranch(page, { prestige: { branch: 2, seals: 3, perks: {}, runCoins: 0 } });
  await open(page);
  await openFranchiseTab(page);
  await page.getByTestId('perk-lucro').click();
  await expect(page.getByTestId('seals')).toHaveText('🏅 1 selos');
  await expect(page.getByText('1/10')).toBeVisible();
});

test('the button is locked below level 12', async ({ page }) => {
  await seedLateBranch(page, { xp: xpFor(11) });
  await open(page);
  await openFranchiseTab(page);
  await expect(page.getByTestId('open-branch')).toBeDisabled();
  await expect(page.getByTestId('open-branch')).toHaveText('Disponível no nível 12');
});
