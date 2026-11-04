import { loadContent } from '@gt/shared';
import { createInitialState, type GameState, rachaStake } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { rachaOptions, trackCard } from '../src/ui/raceTab';
import { S } from '../src/ui/strings';

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

describe('rachaOptions', () => {
  const open = (coins: number) => ({ ...withRace({ beaten: ['bairro'] }), coins });

  it('a bet you cannot pay is disabled, the others stay open', () => {
    const s = open(0);
    const stakes = [0, 1, 2].map((i) => rachaStake(c, s, i as 0 | 1 | 2));
    const opts = rachaOptions(c, { ...s, coins: stakes[1]! }, 0);
    expect(opts.map((o) => o.enabled)).toEqual([true, true, false]);
    expect(opts.map((o) => o.stake)).toEqual(stakes);
  });

  it('all bets are disabled while street races are locked or used up', () => {
    expect(rachaOptions(c, { ...withRace({}), coins: 99999 }, 0).some((o) => o.enabled)).toBe(false);
    const used = { ...withRace({ beaten: ['bairro'], rachas: [1, 2, 3, 4, 5] }), coins: 99999 };
    expect(rachaOptions(c, used, 10).some((o) => o.enabled)).toBe(false);
  });

  it('the locked message names the track that unlocks street races', () => {
    expect(S.race.rachasLocked(c.race.tracks[0]!.name)).toContain(c.race.tracks[0]!.name);
  });
});
