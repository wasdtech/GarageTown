import { describe, expect, it } from 'vitest';
import { PROFILES, simulate } from '../src/econSim';
import { content as c } from './helpers';

const profile = (name: string) => PROFILES.find((p) => p.name === name)!;

/** Minutes of play into an always-on session at which each level is reached. */
function activeMinutes(): Record<number, number> {
  const { levelDay } = simulate(c, { name: 'ativo', sessionsPerDay: 1, sessionS: 8 * 3600 }, 1);
  // the session starts at 08:00
  return Object.fromEntries(Object.entries(levelDay).map(([l, d]) => [l, (d - 8 / 24) * 1440]));
}

describe('pacing (ritmo rápido)', () => {
  it('an active player gets level 5 in the first quarter hour', () => {
    expect(activeMinutes()[5]).toBeLessThanOrEqual(15);
  });

  it('an active player reaches level 10 within about 1.5 h and level 15 within 6 h, not under 4 h', () => {
    const m = activeMinutes();
    expect(m[10]).toBeLessThanOrEqual(100);
    expect(m[15]).toBeLessThanOrEqual(360);
    expect(m[15]).toBeGreaterThanOrEqual(240);
  });

  it('a job unlocked later pays at least as much XP per hour as earlier ones (under an hour long)', () => {
    const active = c.jobs.filter((j) => j.durationS < 3600).sort((a, b) => a.unlockLevel - b.unlockLevel);
    const rate = (j: (typeof active)[number]) => j.xp / j.durationS;
    for (let i = 1; i < active.length; i++) {
      if (active[i]!.unlockLevel > active[i - 1]!.unlockLevel)
        expect(rate(active[i]!)).toBeGreaterThanOrEqual(rate(active[i - 1]!) * 0.99);
    }
  });

  it('jobs an hour or longer (for when you leave) pay less XP per hour than playing', () => {
    const wash = c.jobs.find((j) => j.key === 'wash')!;
    for (const j of c.jobs.filter((x) => x.durationS >= 3600))
      expect(j.xp / j.durationS).toBeLessThan(wash.xp / wash.durationS);
  });
});

describe('economy simulator (spec §2.3)', () => {
  it('the average player reaches level 10 on the first or second day', () => {
    const { levelDay } = simulate(c, profile('medio'), 30);
    expect(levelDay[10]).toBeGreaterThanOrEqual(0.5);
    expect(levelDay[10]).toBeLessThanOrEqual(1.5);
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
  it('the average player hires helpers before the first branch', () => {
    // a new branch starts the garage again, helpers included: look on day 4, before it opens
    const { final } = simulate(c, profile('medio'), 4);
    expect(final.helpers.length).toBeGreaterThanOrEqual(3);
  });

  it('a day of only quick check-ins earns less than a day of the average player', () => {
    const coinsOn = (name: string) => {
      const day = (d: number) => simulate(c, profile(name), d).final;
      // compare day 3 -> day 4 earnings: helpers already hired, before the average player's first new branch
      const a = day(3);
      const b = day(4);
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
