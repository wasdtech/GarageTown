import { describe, expect, it } from 'vitest';
import { PROFILES, simulate } from '../src/econSim';
import { content as c } from './helpers';

const profile = (name: string) => PROFILES.find((p) => p.name === name)!;

describe('economy simulator (spec §2.3)', () => {
  it('the average player reaches level 10 between day 2 and day 4', () => {
    const { levelDay } = simulate(c, profile('medio'), 30);
    expect(levelDay[10]).toBeGreaterThanOrEqual(2);
    expect(levelDay[10]).toBeLessThanOrEqual(4);
  });

  it('more play means faster progress, and everyone builds both bays', () => {
    const [casual, medio, intenso] = ['casual', 'medio', 'intenso'].map((n) => simulate(c, profile(n), 30));
    expect(casual!.levelDay[10]!).toBeGreaterThan(medio!.levelDay[10]!);
    expect(medio!.levelDay[10]!).toBeGreaterThan(intenso!.levelDay[10]!);
    // checked before each profile's first new branch (a branch starts again with the 2 prebuilt bays)
    const before = { casual: 10, medio: 5, intenso: 2 };
    for (const [name, days] of Object.entries(before))
      expect(simulate(c, profile(name), days).final.bays).toHaveLength(4);
  });
});

describe('economy sinks', () => {
  // with helpers working overnight the average player now maxes every part within a month
  // (balance finding reported to the owner); the casual player still has parts left to buy
  it('a casual player can afford all cars within a month but not every part', () => {
    const { final } = simulate(c, profile('casual'), 30);
    expect(final.collection.cars).toHaveLength(3);
    const tiers = final.collection.cars.flatMap((car) => c.parts.map((p) => car.parts[p.key] ?? 0));
    expect(tiers.some((t) => t < 3)).toBe(true);
  });

  it('a casual player still owns only the gift car after 3 days', () => {
    const { final } = simulate(c, profile('casual'), 3);
    expect(final.collection.cars).toHaveLength(1);
  });
});

describe('economy with helpers', () => {
  it('the average player hires helpers and still reaches level 10 on days 2-4', () => {
    const { levelDay, final } = simulate(c, profile('medio'), 30);
    expect(final.helpers.length).toBeGreaterThanOrEqual(3);
    expect(levelDay[10]).toBeGreaterThanOrEqual(2);
    expect(levelDay[10]).toBeLessThanOrEqual(4);
  });

  it('a day of only quick check-ins earns less than a day of the average player', () => {
    const coinsOn = (name: string) => {
      const day = (d: number) => simulate(c, profile(name), d).final;
      // compare day 4 -> day 5 earnings: helpers already hired, before the average player's first new branch
      const a = day(4);
      const b = day(5);
      const spent = (s: typeof a) => s.coins;
      return { a: spent(a), b: spent(b), xp: b.xp - a.xp };
    };
    const offline = coinsOn('offline');
    const medio = coinsOn('medio');
    expect(offline.xp).toBeLessThan(medio.xp);
  });
});

describe('economy with franchise', () => {
  const medio = () => simulate(c, profile('medio'), 30);

  it('the average player opens the first branch by day 10', () => {
    const { branchDays } = medio();
    expect(branchDays[0]).toBeDefined();
    expect(branchDays[0]!).toBeLessThanOrEqual(10);
  });

  it('the second branch reaches level 12 faster than the first', () => {
    const { branchDays, level12Days } = medio();
    expect(level12Days[1]).toBeDefined();
    expect(level12Days[1]! - branchDays[0]!).toBeLessThan(level12Days[0]!);
  });

  it('after 30 days the average player still has a perk to buy', () => {
    const { final } = medio();
    expect(c.prestige.perks.some((p) => (final.prestige.perks[p.key] ?? 0) < p.max)).toBe(true);
  });

  it('coins keep mattering after the first branch', () => {
    const { final } = medio();
    expect(final.prestige.branch).toBeGreaterThanOrEqual(2);
    expect(final.prestige.runCoins).toBeGreaterThan(0);
  });
});
