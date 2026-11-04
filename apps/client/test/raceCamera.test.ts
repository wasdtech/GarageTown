import { describe, expect, it } from 'vitest';
import { COAST_M, coastMeters, leaderOf, smoothToward } from '../src/race/raceCamera';

describe('coastMeters', () => {
  it('rolls on from the line and brakes to a stop COAST_M later', () => {
    expect(coastMeters(40, 0)).toBe(0);
    const a = coastMeters(40, 300);
    const b = coastMeters(40, 600);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    // stops after 2·COAST_M/v seconds and stays there
    expect(coastMeters(40, 1500)).toBeCloseTo(COAST_M, 5);
    expect(coastMeters(40, 9000)).toBeCloseTo(COAST_M, 5);
  });

  it('starts at the speed it crossed the line with (no jump)', () => {
    // first 10 ms: about v·dt
    expect(coastMeters(40, 10)).toBeCloseTo(0.4, 1);
  });

  it('a car that crossed at no speed stays put', () => {
    expect(coastMeters(0, 500)).toBe(0);
  });
});

describe('leaderOf', () => {
  it('follows you unless the rival is clearly ahead', () => {
    expect(leaderOf(100, 104)).toBe('you');
    expect(leaderOf(100, 106)).toBe('rival');
    expect(leaderOf(110, 106)).toBe('you');
  });
});

describe('smoothToward', () => {
  it('moves part of the way each frame, never past the target', () => {
    const next = smoothToward(0, 100, 16);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(30);
    expect(smoothToward(0, 100, 10_000)).toBeLessThanOrEqual(100);
  });

  it('a leader switch eases over several frames instead of jumping', () => {
    let x = 0;
    const steps: number[] = [];
    for (let i = 0; i < 10; i++) {
      const n = smoothToward(x, 50, 16);
      steps.push(n - x);
      x = n;
    }
    expect(Math.max(...steps)).toBeLessThan(15);
  });
});
