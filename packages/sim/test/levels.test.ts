import { describe, expect, it } from 'vitest';
import { loadContent } from '@gt/shared';
import { levelForXp, maxLevel, unlockedJobs } from '../src/levels';

const c = loadContent();

describe('levels', () => {
  it('maps xp to level using cumulative thresholds', () => {
    expect(levelForXp(c, 0)).toBe(1);
    expect(levelForXp(c, 19)).toBe(1);
    expect(levelForXp(c, 20)).toBe(2);
    expect(levelForXp(c, 250)).toBe(5);
  });

  it('caps at the max level when xp jumps far ahead', () => {
    expect(levelForXp(c, 99999)).toBe(15);
    expect(maxLevel(c)).toBe(15);
    expect(levelForXp(c, 6999)).toBe(14);
  });

  it('lists jobs unlocked at a level', () => {
    expect(unlockedJobs(c, 1).map((j) => j.key)).toEqual(['wash', 'oil']);
    expect(unlockedJobs(c, 4).map((j) => j.key)).toEqual([
      'wash',
      'oil',
      'polish',
      'tires',
      'engine',
      'touchup',
    ]);
    expect(unlockedJobs(c, 15)).toHaveLength(11);
  });
});
