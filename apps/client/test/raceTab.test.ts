import { loadContent } from '@gt/shared';
import { createInitialState, type GameState } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { trackCard } from '../src/ui/raceTab';

const c = loadContent();
const withRace = (race: Partial<GameState['race']>): GameState => {
  const s = createInitialState(c, 0, 1);
  return { ...s, race: { ...s.race, ...race } };
};

describe('trackCard', () => {
  it('opens the first track only, with your PI against the recommended one', () => {
    const s = withRace({});
    expect(trackCard(c, s, 'bairro')).toEqual({
      unlocked: true,
      medals: [false, false, false],
      piYours: 180,
      piTarget: 180,
    });
    expect(trackCard(c, s, 'avenida').unlocked).toBe(false);
  });

  it('lights the medals already won', () => {
    expect(trackCard(c, withRace({ medals: { bairro: 2 } }), 'bairro').medals).toEqual([true, true, false]);
  });
});
