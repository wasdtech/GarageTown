import { describe, expect, it } from 'vitest';
import { type RaceCar, rivalInputs, scriptInputs, simulateRace } from '../src/race';
import { content as c } from './helpers';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const carOfPi = (pi: number): RaceCar => ({ power: pi / 4, grip: pi / 4 });
const AVERAGE = { reactionMs: 300, shiftRpm: 'goodEdge' as const, nitroGear: 3 as const };
const OPTIMAL = { reactionMs: 150, shiftRpm: 'center' as const, nitroGear: 3 as const };
/** Mean race time over the seeds for a car and a player profile. */
const mean = (car: RaceCar, p: Parameters<typeof scriptInputs>[2]) =>
  SEEDS.reduce((sum, s) => sum + simulateRace(s, car, scriptInputs(s, car, p)).timeMs, 0) / SEEDS.length;

describe('drag race balance (spec B1)', () => {
  for (const t of c.race.tracks) {
    describe(t.key, () => {
      it('average player with the recommended car makes bronze', () => {
        const avg = mean(carOfPi(t.pi), AVERAGE);
        expect(avg).toBeLessThanOrEqual(t.medals.bronze);
        expect(avg).toBeGreaterThan(t.medals.silver);
      });

      it('optimal player with the recommended car makes silver but not gold', () => {
        const opt = mean(carOfPi(t.pi), OPTIMAL);
        expect(opt).toBeLessThanOrEqual(t.medals.silver);
        expect(opt).toBeGreaterThan(t.medals.gold);
      });

      it('optimal player with a car 15% above makes gold', () => {
        expect(mean(carOfPi(t.pi * 1.15), OPTIMAL)).toBeLessThanOrEqual(t.medals.gold);
      });
    });
  }

  for (const key of ['bairro', 'avenida']) {
    it(`the average player with the recommended car beats the rival on ${key}`, () => {
      const t = c.race.tracks.find((x) => x.key === key)!;
      const rival =
        SEEDS.reduce((sum, s) => sum + simulateRace(s, t.rival, rivalInputs(s, t.rival)).timeMs, 0) /
        SEEDS.length;
      expect(mean(carOfPi(t.pi), AVERAGE)).toBeLessThan(rival);
    });
  }

  // spec: a perfect run is much faster than a poor one in the same car, but does not make up for a
  // much weaker car (shift times are fixed by the spec, so this is the measurable form of "about 40%")
  const POOR = (pi: number) => ({
    reactionMs: 450,
    shiftRpm: 7000 - (600 + 6 * (pi / 4)) / 2 - 150,
    nitroGear: 3 as const,
  });

  it('a perfect run is much faster than a poor one in the same car', () => {
    const pi = 280;
    const carGap = mean(carOfPi(pi), OPTIMAL) - mean(carOfPi(pi * 1.3), OPTIMAL);
    expect(mean(carOfPi(pi), POOR(pi)) - mean(carOfPi(pi), OPTIMAL)).toBeGreaterThanOrEqual(0.5 * carGap);
  });

  it('a perfect run does not make up for a car 20% weaker', () => {
    const pi = 280;
    expect(mean(carOfPi(pi * 1.2), AVERAGE)).toBeLessThan(mean(carOfPi(pi), OPTIMAL));
  });
});
