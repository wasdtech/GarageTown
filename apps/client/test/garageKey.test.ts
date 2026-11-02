import { loadContent } from '@gt/shared';
import { createInitialState } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { garageKey } from '../src/ui/garageKey';

const c = loadContent();
const T0 = 1_700_000_000_000;

describe('garageKey', () => {
  it('ignores coin changes (helper payouts must not rebuild the open sheet)', () => {
    const s = createInitialState(c, T0, 1);
    expect(garageKey(c, { ...s, coins: 999 })).toBe(garageKey(c, s));
  });

  it('changes with the level, the garage, the team and the clock', () => {
    const s = createInitialState(c, T0, 1);
    const k = garageKey(c, s);
    expect(garageKey(c, { ...s, xp: 20 })).not.toBe(k);
    expect(garageKey(c, { ...s, clockTier: 1 })).not.toBe(k);
    expect(garageKey(c, { ...s, helpers: [{ key: 'ze', level: 1, bayId: null }] })).not.toBe(k);
  });
});
