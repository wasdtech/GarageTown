import { loadContent } from '@gt/shared';
import { createInitialState, type GameState } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { branchPreview, levelEvents, perkLine } from '../src/ui/franchise';

const c = loadContent();
const d = c.prestige.sealDivisor;
const xpFor = (level: number) => c.levels[level - 1]!.xp;
const state = (level: number, runCoins: number, perks: Record<string, number> = {}): GameState => {
  const s = createInitialState(c, 0, 1);
  return { ...s, xp: xpFor(level), prestige: { ...s.prestige, runCoins, perks } };
};

describe('branchPreview', () => {
  it('is locked below level 12', () => {
    expect(branchPreview(c, state(11, 99 * d))).toMatchObject({ canOpen: false, reason: 'level' });
  });

  it('needs at least one seal, and says how far the next one is', () => {
    expect(branchPreview(c, state(12, d - 1))).toEqual({
      seals: 0,
      coinsToNext: 1,
      canOpen: false,
      reason: 'no_seals',
    });
  });

  it('previews the seals and the coins to the next seal', () => {
    expect(branchPreview(c, state(12, 25 * d + 100))).toEqual({
      seals: 5,
      coinsToNext: 36 * d - (25 * d + 100),
      canOpen: true,
      reason: null,
    });
  });
});

describe('perkLine', () => {
  it('shows the effect now, next and the cost of the next level', () => {
    expect(perkLine(c, state(1, 0, { lucro: 2 }), 'lucro')).toEqual({
      now: '+20% moedas',
      next: '+30% moedas',
      cost: 4,
    });
    expect(perkLine(c, state(1, 0), 'agilidade')).toEqual({ now: '−0% tempo', next: '−5% tempo', cost: 3 });
  });

  it('has no next level at the max', () => {
    expect(perkLine(c, state(1, 0, { recrutamento: 4 }), 'recrutamento')).toEqual({
      now: '−60% custo de ajudantes',
      next: null,
      cost: null,
    });
  });
});

describe('levelEvents', () => {
  it('a new branch dropping the level is not a level-up; the next real level-up is', () => {
    expect(levelEvents(c, 13, 1)).toEqual({ levelUp: false, franchise: false });
    expect(levelEvents(c, 1, 2)).toEqual({ levelUp: true, franchise: false });
  });

  it('announces the franchise once, when level 12 is reached', () => {
    expect(levelEvents(c, 11, 12)).toEqual({ levelUp: true, franchise: true });
    expect(levelEvents(c, 12, 13)).toEqual({ levelUp: true, franchise: false });
    expect(levelEvents(c, 10, 13)).toEqual({ levelUp: true, franchise: true });
  });
});
