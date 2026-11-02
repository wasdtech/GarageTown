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
    for (const r of [casual, medio, intenso]) expect(r!.final.bays).toHaveLength(4);
  });
});

describe('economy sinks', () => {
  it('the average player can afford all cars within a month but not every part', () => {
    const { final } = simulate(c, profile('medio'), 30);
    expect(final.collection.cars).toHaveLength(3);
    const tiers = final.collection.cars.flatMap((car) => c.parts.map((p) => car.parts[p.key] ?? 0));
    expect(tiers.some((t) => t < 3)).toBe(true);
  });

  it('a casual player still owns only the gift car after 3 days', () => {
    const { final } = simulate(c, profile('casual'), 3);
    expect(final.collection.cars).toHaveLength(1);
  });
});
