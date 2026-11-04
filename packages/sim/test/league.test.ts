import type { Content } from '@gt/shared';
import { describe, expect, it } from 'vitest';
import {
  finishRace,
  type RaceTarget,
  rachaPayout,
  rachasLeft,
  rachaStake,
  raceSeed,
  raceSetup,
  trackUnlocked,
} from '../src/league';
import { scriptInputs } from '../src/race';
import { createInitialState, type GameState } from '../src/state';
import { content as c, T0 } from './helpers';

const ok = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const fresh = (extra: Partial<GameState> = {}): GameState => ({
  ...createInitialState(c, T0, 1),
  nextCustomerAt: Number.MAX_SAFE_INTEGER,
  ...extra,
});
const withRace = (race: Partial<GameState['race']>, extra: Partial<GameState> = {}) =>
  fresh({ ...extra, race: { medals: {}, beaten: [], rachas: [], count: 0, ...race } });

/** Taps of a player as good as asked, for the race this state would run. */
function taps(cc: Content, s: GameState, target: RaceTarget, how: 'optimal' | 'poor') {
  const setup = ok(raceSetup(cc, s, target, T0));
  return how === 'optimal'
    ? scriptInputs(setup.seed, setup.car, { reactionMs: 120, shiftRpm: 'center', nitroGear: 3 })
    : scriptInputs(setup.seed, setup.car, { reactionMs: 600, shiftRpm: 3000 });
}

/** A content where the bairro rival drives exactly the gift car (power 40, grip 50). */
const twin: Content = {
  ...c,
  race: {
    ...c.race,
    tracks: c.race.tracks.map((t, i) => (i === 0 ? { ...t, rival: { ...t.rival, power: 40, grip: 50 } } : t)),
  },
};

describe('league', () => {
  it('only the first track is open at first; beating its rival opens the next', () => {
    expect(trackUnlocked(c, fresh(), 'bairro')).toBe(true);
    expect(trackUnlocked(c, fresh(), 'avenida')).toBe(false);
    expect(raceSetup(c, fresh(), { track: 'avenida' }, T0)).toEqual({ ok: false, error: 'locked' });
    expect(raceSetup(c, fresh(), { track: 'lua' }, T0)).toEqual({ ok: false, error: 'unknown_track' });
    const s = fresh();
    const r = ok(finishRace(c, s, { track: 'bairro' }, taps(c, s, { track: 'bairro' }, 'optimal'), T0));
    expect(r.outcome.won).toBe(true);
    expect(r.state.race.beaten).toEqual(['bairro']);
    expect(trackUnlocked(c, r.state, 'avenida')).toBe(true);
  });

  it('a medal pays once, lower tiers included', () => {
    // a very easy content: every finished race is gold
    const easy: Content = {
      ...c,
      race: {
        ...c.race,
        tracks: c.race.tracks.map((t) => ({
          ...t,
          medals: { bronze: 59_000, silver: 58_000, gold: 57_000 },
        })),
      },
    };
    const s = fresh();
    const r1 = ok(
      finishRace(easy, s, { track: 'bairro' }, taps(easy, s, { track: 'bairro' }, 'optimal'), T0),
    );
    expect(r1.outcome).toMatchObject({ medal: 3, newMedal: true, coins: 100 + 200 + 400, xp: 3 * 20 });
    expect(r1.state.coins).toBe(700);
    const r2 = ok(
      finishRace(
        easy,
        r1.state,
        { track: 'bairro' },
        taps(easy, r1.state, { track: 'bairro' }, 'optimal'),
        T0 + 1,
      ),
    );
    expect(r2.outcome).toMatchObject({ medal: 3, newMedal: false, coins: 0, xp: 0 });
    expect(r2.state.race.medals.bairro).toBe(3);
  });

  it('a tie does not unlock and refunds a street race', () => {
    const s = fresh();
    const setup = ok(raceSetup(twin, s, { track: 'bairro' }, T0));
    const r = ok(finishRace(twin, s, { track: 'bairro' }, setup.rivalInputs, T0));
    expect(r.outcome.tie).toBe(true);
    expect(r.outcome.won).toBe(false);
    expect(r.state.race.beaten).toEqual([]);
    expect(rachaPayout(150, 'tie')).toBe(150);
    expect(rachaPayout(150, 'win')).toBe(300);
    expect(rachaPayout(150, 'loss')).toBe(0);
  });

  it('finish uses the showcase car in the state', () => {
    const s = fresh();
    const inputs = taps(c, s, { track: 'bairro' }, 'optimal');
    const slow = ok(finishRace(c, s, { track: 'bairro' }, inputs, T0)).outcome.player.timeMs;
    const tuned = {
      ...s,
      collection: {
        ...s.collection,
        cars: s.collection.cars.map((car) => ({ ...car, parts: { engine: 3, turbo: 3 } })),
      },
    };
    const fast = ok(finishRace(c, tuned, { track: 'bairro' }, inputs, T0)).outcome.player.timeMs;
    expect(fast).toBeLessThan(slow);
  });

  it('race count advances so each race gets a new seed', () => {
    const s = fresh();
    const r = ok(finishRace(c, s, { track: 'bairro' }, taps(c, s, { track: 'bairro' }, 'poor'), T0));
    expect(r.state.race.count).toBe(1);
    expect(raceSeed(r.state)).not.toBe(raceSeed(s));
  });

  it('race prizes count toward runCoins', () => {
    const s = fresh();
    const r = ok(finishRace(c, s, { track: 'bairro' }, taps(c, s, { track: 'bairro' }, 'optimal'), T0));
    expect(r.outcome.coins).toBeGreaterThan(0);
    expect(r.state.prestige.runCoins).toBe(s.prestige.runCoins + r.outcome.coins);
  });
});

describe('street races', () => {
  const rich = (extra: Partial<GameState['race']> = {}) =>
    withRace({ beaten: ['bairro'], ...extra }, { coins: 1000, xp: c.levels[4]!.xp });

  it('street races unlock after beating bairro', () => {
    expect(raceSetup(c, fresh({ coins: 1000 }), { racha: 0 }, T0)).toEqual({ ok: false, error: 'locked' });
    expect(raceSetup(c, rich(), { racha: 0 }, T0).ok).toBe(true);
  });

  it('stakes grow with the level', () => {
    expect(rachaStake(c, rich(), 0)).toBe(Math.floor(50 * (1 + 5 / 5)));
    expect(rachaStake(c, rich(), 2)).toBe(Math.floor(400 * (1 + 5 / 5)));
  });

  it('a street race charges and pays in one action', () => {
    // the rival is drawn from the seed: find one race the optimal player wins and one the poor player loses
    const seeds = Array.from({ length: 20 }, (_, n) => rich({ count: n }));
    const winState = seeds.find(
      (s) => ok(finishRace(c, s, { racha: 0 }, taps(c, s, { racha: 0 }, 'optimal'), T0)).outcome.won,
    )!;
    const loseState = seeds.find(
      (s) => !ok(finishRace(c, s, { racha: 0 }, taps(c, s, { racha: 0 }, 'poor'), T0)).outcome.won,
    )!;
    const stake = rachaStake(c, winState, 0);
    const win = ok(finishRace(c, winState, { racha: 0 }, taps(c, winState, { racha: 0 }, 'optimal'), T0));
    expect(win.state.coins).toBe(1000 + stake);
    expect(win.state.prestige.runCoins).toBe(winState.prestige.runCoins + stake);
    expect(win.outcome).toMatchObject({ stake, coins: stake });
    const lose = ok(finishRace(c, loseState, { racha: 0 }, taps(c, loseState, { racha: 0 }, 'poor'), T0));
    expect(lose.state.coins).toBe(1000 - stake);
    expect(lose.outcome.coins).toBe(0);
    const broke = { ...winState, coins: stake - 1 };
    expect(finishRace(c, broke, { racha: 0 }, [], T0)).toEqual({ ok: false, error: 'no_coins' });
    expect(broke.coins).toBe(stake - 1);
  });

  it('five street races per 24 h', () => {
    let s = rich();
    for (let i = 0; i < 5; i++) {
      expect(rachasLeft(c, s, T0 + i)).toBe(5 - i);
      s = ok(finishRace(c, s, { racha: 0 }, taps(c, s, { racha: 0 }, 'optimal'), T0 + i)).state;
    }
    expect(finishRace(c, s, { racha: 0 }, [], T0 + 10)).toEqual({ ok: false, error: 'rate_limited' });
    expect(rachasLeft(c, s, T0 + 86_400_000 + 10)).toBe(5);
  });

  it('the street race rival is within 10% of your car', () => {
    for (let n = 0; n < 30; n++) {
      const s = rich({ count: n });
      const rival = ok(raceSetup(c, s, { racha: 1 }, T0)).rival;
      const pi = 2 * (rival.power + rival.grip);
      expect(pi).toBeGreaterThanOrEqual(0.9 * 180 - 1);
      expect(pi).toBeLessThanOrEqual(1.1 * 180 + 1);
      expect(rival.skill).toBeGreaterThanOrEqual(0.4);
      expect(rival.skill).toBeLessThanOrEqual(0.8);
    }
  });
});
