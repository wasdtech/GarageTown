import { describe, expect, it } from 'vitest';
import {
  createRace,
  greenAtMs,
  greenBand,
  type RaceCar,
  type RaceInput,
  rivalInputs,
  scriptInputs,
  simulateRace,
} from '../src/race';

const CAR: RaceCar = { power: 50, grip: 50 };
const SEED = 7;
const clean = (seed = SEED, car = CAR, shiftRpm: 'center' | 'goodEdge' | number = 'goodEdge') =>
  scriptInputs(seed, car, { reactionMs: 200, shiftRpm, nitroGear: 3 });

describe('race physics', () => {
  it('same inputs give the same result', () => {
    expect(simulateRace(SEED, CAR, clean())).toEqual(simulateRace(SEED, CAR, clean()));
  });

  it('green comes between 1.5 and 3 s', () => {
    for (let s = 1; s <= 200; s++) {
      expect(greenAtMs(s)).toBeGreaterThanOrEqual(1500);
      expect(greenAtMs(s)).toBeLessThanOrEqual(3000);
    }
  });

  it('a false start adds 1000 ms', () => {
    const g = greenAtMs(SEED);
    const rest = clean().filter((i) => i.kind !== 'release');
    const onTime = simulateRace(SEED, CAR, [{ kind: 'release', t: g }, ...rest]);
    const early = simulateRace(SEED, CAR, [{ kind: 'release', t: g - 100 }, ...rest]);
    expect(early.falseStart).toBe(true);
    expect(onTime.falseStart).toBe(false);
    expect(Math.abs(early.timeMs - onTime.timeMs - 1000)).toBeLessThanOrEqual(15);
  });

  it('no release leaves 2 s after green', () => {
    const r = simulateRace(SEED, CAR, []);
    expect(r.finished).toBe(true);
    expect(r.reactionMs).toBe(2000);
  });

  it('shift grades follow the band', () => {
    const b = greenBand(CAR.grip);
    expect(simulateRace(SEED, CAR, clean(SEED, CAR, 'center')).shifts).toEqual([
      'perfect',
      'perfect',
      'perfect',
    ]);
    expect(simulateRace(SEED, CAR, clean(SEED, CAR, 'goodEdge')).shifts).toEqual(['good', 'good', 'good']);
    expect(simulateRace(SEED, CAR, clean(SEED, CAR, b.lo - 1000)).shifts).toEqual(['bad', 'bad', 'bad']);
  });

  it('more grip widens the band', () => {
    const w = (g: number) => greenBand(g).hi - greenBand(g).lo;
    expect(w(120)).toBeGreaterThan(w(40));
    expect(w(50)).toBe(600 + 6 * 50);
  });

  it('more power is faster with the same taps', () => {
    const inputs = clean();
    expect(simulateRace(SEED, { power: 90, grip: 50 }, inputs).timeMs).toBeLessThan(
      simulateRace(SEED, CAR, inputs).timeMs,
    );
  });

  it('perfect beats good beats bad', () => {
    const t = (rpm: 'center' | 'goodEdge' | number) => simulateRace(SEED, CAR, clean(SEED, CAR, rpm)).timeMs;
    expect(t('center')).toBeLessThan(t('goodEdge'));
    expect(t('goodEdge')).toBeLessThan(t(greenBand(CAR.grip).lo - 1000));
  });

  it('nitro only once', () => {
    const inputs = clean();
    const nitro = inputs.find((i) => i.kind === 'nitro')!;
    const twice = [...inputs, { kind: 'nitro' as const, t: nitro.t + 2500 }];
    expect(simulateRace(SEED, CAR, twice).timeMs).toBe(simulateRace(SEED, CAR, inputs).timeMs);
  });

  it('the limiter holds the car without a shift', () => {
    const race = createRace(SEED, CAR);
    race.input({ kind: 'release', t: greenAtMs(SEED) });
    const limit1 = (45 + 0.25 * CAR.power) * 0.35;
    for (let t = 0; t <= 20_000; t += 100) {
      const v = race.advance(t);
      expect(v.gear).toBe(1);
      expect(v.speed).toBeLessThanOrEqual(limit1 + 1e-9);
      expect(v.rpm).toBeLessThanOrEqual(8000 + 1e-9);
    }
  });

  it('ignores extra and early taps', () => {
    const inputs = clean();
    const g = greenAtMs(SEED);
    const first = inputs.find((i) => i.kind === 'shift')!;
    const noisy: RaceInput[] = [
      { kind: 'shift', t: g - 500 },
      { kind: 'nitro', t: g - 400 },
      ...inputs,
      { kind: 'release', t: g + 900 },
      { kind: 'shift', t: first.t + 20 },
      { kind: 'shift', t: first.t + 40 },
    ];
    expect(simulateRace(SEED, CAR, noisy).timeMs).toBe(simulateRace(SEED, CAR, inputs).timeMs);
  });

  it('a skilled rival is faster than a clumsy one in the same car', () => {
    const t = (skill: number) => simulateRace(SEED, CAR, rivalInputs(SEED, { ...CAR, skill })).timeMs;
    expect(t(0.9)).toBeLessThan(t(0.1));
  });

  it('the trace samples metres every 50 ms and ends at the finish', () => {
    const r = simulateRace(SEED, CAR, clean());
    expect(r.trace.length).toBeGreaterThan(10);
    expect(r.trace[r.trace.length - 1]).toBeGreaterThanOrEqual(400);
  });
});
