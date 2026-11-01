import { describe, expect, it } from 'vitest';
import { createScrubTracker } from '../src/minigames/scrub';

describe('scrub tracker', () => {
  it('accumulates distance and elapsed time', () => {
    const t = createScrubTracker(3000);
    for (let i = 0; i < 30; i++) t.add(100, 0, i * 100);
    expect(t.progress()).toBe(1);
    expect(t.elapsedMs()).toBe(2_900);
  });

  it('caps a single huge movement at 400px', () => {
    const t = createScrubTracker(3000);
    t.add(5000, 0, 0);
    expect(t.progress()).toBeCloseTo(400 / 3000);
  });

  it('starts at zero', () => {
    const t = createScrubTracker(3000);
    expect(t.progress()).toBe(0);
    expect(t.elapsedMs()).toBe(0);
  });
});
