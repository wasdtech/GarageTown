import { describe, expect, it } from 'vitest';
import { loadContent } from '@gt/shared';
import { createInitialState, nextRandom } from '../src/state';
import { tick } from '../src/customers';

const c = loadContent();
const T0 = 1_700_000_000_000;

describe('initial state', () => {
  it('starts empty with a wash and a mechanic bay', () => {
    const s = createInitialState(c, T0, 42);
    expect(s.coins).toBe(0);
    expect(s.xp).toBe(0);
    expect(s.queue).toEqual([]);
    expect(s.bays.map((b) => [b.type, b.tile.x, b.tile.y, b.job])).toEqual([
      ['wash', 2, 3, null],
      ['mechanic', 5, 3, null],
    ]);
    expect(s.nextCustomerAt).toBe(T0 + 20_000);
  });

  it('rng yields values in [0,1) deterministically', () => {
    const [a, s1] = nextRandom(42);
    const [b] = nextRandom(42);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(nextRandom(s1)[0]).not.toBe(a);
  });
});

describe('tick', () => {
  it('spawns a customer after the arrival interval', () => {
    const s = tick(c, createInitialState(c, T0, 42), T0 + 20_000);
    expect(s.queue).toHaveLength(1);
    const cust = s.queue[0]!;
    expect(['wash', 'oil']).toContain(cust.need);
    expect(cust.patienceUntil).toBe(cust.arrivedAt + 120_000);
  });

  it('is deterministic for the same seed and times', () => {
    const a = tick(c, createInitialState(c, T0, 7), T0 + 95_000);
    const b = tick(c, createInitialState(c, T0, 7), T0 + 95_000);
    expect(a).toEqual(b);
  });

  it('after 10h away fills the queue to 6 in constant time', () => {
    const now = T0 + 10 * 3_600_000;
    const s0 = createInitialState(c, T0, 1);
    const t = performance.now();
    const s = tick(c, s0, now);
    expect(performance.now() - t).toBeLessThan(5);
    expect(s.queue).toHaveLength(6);
    for (const q of s.queue) expect(q.patienceUntil).toBeGreaterThan(now);
  });

  it('removes customers whose patience ran out', () => {
    const s1 = tick(c, createInitialState(c, T0, 3), T0 + 20_000);
    const s2 = tick(c, { ...s1, nextCustomerAt: Number.MAX_SAFE_INTEGER }, T0 + 20_000 + 120_001);
    expect(s2.queue).toHaveLength(0);
  });

  it('ignores a clock that moved backwards', () => {
    const s1 = tick(c, createInitialState(c, T0, 5), T0 + 60_000);
    const s2 = tick(c, s1, T0 + 30_000);
    expect(s2).toEqual(s1);
  });
});
