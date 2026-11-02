import { describe, expect, it } from 'vitest';
import { collectJob, startJob } from '../src/jobs';
import { tick } from '../src/customers';
import { createInitialState, type Customer, type GameState } from '../src/state';
import { content as c, T0 } from './helpers';

const PAINT_BAY = { id: 'bay3', type: 'paint' as const, tile: { x: 2, y: 0 }, job: null };

/** Spawns `n` customers one by one, emptying the queue each time, and returns them. */
function arrivals(base: GameState, n: number): Customer[] {
  let s = { ...base, nextCustomerAt: T0 + 20_000 };
  const out: Customer[] = [];
  for (let i = 1; i <= n; i++) {
    s = tick(c, s, T0 + i * 20_000);
    out.push(...s.queue);
    s = { ...s, queue: [] };
  }
  return out;
}

describe('customer needs', () => {
  it('only ask for jobs of bay types the player owns', () => {
    const s = { ...createInitialState(c, T0, 4), xp: 2500 }; // level 11, only wash + mechanic
    const needs = new Set(arrivals(s, 120).map((q) => q.need));
    for (const n of needs) expect(['wash', 'oil', 'polish', 'tires', 'engine']).toContain(n);
  });
});

describe('VIP customers', () => {
  it('never appear below 10 reputation', () => {
    const s = {
      ...createInitialState(c, T0, 5),
      xp: 2500,
      reputation: 9,
      bays: [...createInitialState(c, T0, 5).bays, PAINT_BAY],
    };
    expect(arrivals(s, 200).some((q) => q.vip)).toBe(false);
  });

  it('are about 10% of arrivals from 10 reputation, with high-level needs and 4 min patience', () => {
    const s = {
      ...createInitialState(c, T0, 6),
      xp: 2500,
      reputation: 10,
      bays: [...createInitialState(c, T0, 6).bays, PAINT_BAY],
    };
    const all = arrivals(s, 400);
    const vips = all.filter((q) => q.vip);
    expect(vips.length / all.length).toBeGreaterThan(0.05);
    expect(vips.length / all.length).toBeLessThan(0.18);
    for (const v of vips) {
      expect(c.jobs.find((j) => j.key === v.need)!.unlockLevel).toBeGreaterThanOrEqual(4);
      expect(v.patienceUntil - v.arrivedAt).toBe(240_000);
    }
  });

  it('pay double coins', () => {
    const base = { ...createInitialState(c, T0, 1), xp: 130, nextCustomerAt: Number.MAX_SAFE_INTEGER };
    const vip: Customer = {
      id: 'v',
      carKey: 'pitoco',
      need: 'touchup',
      arrivedAt: T0,
      patienceUntil: T0 + 240_000,
      vip: true,
    };
    const s = { ...base, bays: [...base.bays, PAINT_BAY], queue: [vip] };
    const r = startJob(c, s, { customerId: 'v', bayId: 'bay3', jobKey: 'touchup' }, T0);
    if (!r.ok) throw new Error(r.error);
    const done = collectJob(c, r.value, 'bay3', T0 + 600_000);
    if (!done.ok) throw new Error(done.error);
    // 70 x2 = 140, tip floor(140*0.2) = 28, timely floor(140*0.1) = 14
    expect(done.value.reward.coins).toBe(182);
  });
});
