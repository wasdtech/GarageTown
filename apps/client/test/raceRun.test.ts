import { greenAtMs, simulateRace } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { RaceRun } from '../src/race/raceRun';

const CAR = { power: 50, grip: 50 };
const SEED = 3;
const run = () => new RaceRun(SEED, CAR, CAR, []);

describe('RaceRun', () => {
  it('holding before green and letting go on green launches the car', () => {
    const r = run();
    r.goDown();
    r.frame(greenAtMs(SEED));
    expect(r.lights()).toEqual(['off', 'off', 'green']);
    r.goUp();
    expect(r.inputs).toEqual([{ kind: 'release', t: greenAtMs(SEED) }]);
    const s = r.frame(500);
    expect(s.view.speed).toBeGreaterThan(0);
    expect(s.jumped).toBe(false);
  });

  it('letting go before green is a jumped start, flagged once', () => {
    const r = run();
    r.goDown();
    r.frame(500);
    r.goUp();
    expect(r.frame(10).jumped).toBe(true);
    expect(r.frame(10).jumped).toBe(false);
  });

  it('after the launch each press is a gear change and is graded once', () => {
    const r = run();
    r.frame(greenAtMs(SEED));
    r.goUp();
    r.frame(1500);
    r.goDown();
    const s = r.frame(10);
    expect(s.view.gear).toBe(2);
    expect(s.graded).not.toBeNull();
    expect(r.frame(10).graded).toBeNull();
  });

  it('a race finished instantly gives the same result as the simulation of its taps', () => {
    const r = run();
    const taps = [{ kind: 'release' as const, t: greenAtMs(SEED) + 200 }];
    r.runInstant(taps);
    expect(r.finished).toBe(true);
    expect(r.result()).toEqual(simulateRace(SEED, CAR, taps));
  });
});
