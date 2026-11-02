import { describe, expect, it } from 'vitest';
import { tick } from '../src/customers';
import { assignHelper, hireHelper } from '../src/helpers';
import { clearIdleReport } from '../src/idle';
import { collectJob, startJob } from '../src/jobs';
import { createInitialState, type Customer, type GameState } from '../src/state';
import { content as c, T0 } from './helpers';

const HOUR = 3_600_000;
const ok = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const customer = (id: string, need: string, at = T0): Customer => ({
  id,
  carKey: 'pitoco',
  need,
  arrivedAt: at,
  patienceUntil: at + 120_000,
});

/** Level-2 garage with Zé hired on the wash bay; no natural arrivals unless asked. */
function withZe(queue: Customer[], extra: Partial<GameState> = {}): GameState {
  let s: GameState = {
    ...createInitialState(c, T0, 1),
    xp: 20,
    coins: 300,
    queue,
    nextCustomerAt: Number.MAX_SAFE_INTEGER,
  };
  s = ok(hireHelper(c, s, 'ze', T0));
  s = ok(assignHelper(s, 'ze', 'bay1', T0));
  return { ...s, ...extra };
}

describe('helper on a bay', () => {
  it('starts the matching job at once and collects it at 80% without tip', () => {
    const s0 = withZe([customer('a', 'wash')]);
    const s1 = tick(c, s0, T0 + 1);
    expect(s1.bays[0]!.job).toMatchObject({ jobKey: 'wash', byHelper: 'ze', startedAt: T0, durationS: 30 });
    const s2 = tick(c, s1, T0 + 30_000);
    expect(s2.bays[0]!.job).toBeNull();
    // floor(5 * 0.8) = 4 coins, full 3 xp, no tip, no reputation
    expect(s2.coins).toBe(4);
    expect(s2.xp).toBe(23);
    expect(s2.reputation).toBe(0);
    expect(s2.idleReport).toEqual({ jobs: 1, coins: 4, xp: 3 });
  });

  it('never starts over a job the player started and leaves its manual reward alone', () => {
    const s0 = withZe([customer('a', 'wash'), customer('b', 'wash')]);
    const mine = ok(startJob(c, s0, { customerId: 'a', bayId: 'bay1', jobKey: 'wash' }, T0));
    const later = tick(c, mine, T0 + 10_000);
    expect(later.bays[0]!.job).toMatchObject({ customerId: 'a' });
    expect(later.bays[0]!.job!.byHelper).toBeUndefined();
    const collected = ok(collectJob(c, later, 'bay1', T0 + 30_000));
    expect(collected.reward).toMatchObject({ coins: 6, tip: 1 });
  });

  it('only takes customers of its bay type; others wait and leave as usual', () => {
    const s0 = withZe([customer('oily', 'oil')]);
    const s1 = tick(c, s0, T0 + 60_000);
    expect(s1.bays[0]!.job).toBeNull();
    expect(s1.queue.map((q) => q.id)).toEqual(['oily']);
    expect(tick(c, s1, T0 + 121_000).queue).toEqual([]);
  });

  it('pays helper rules when the player collects a job a helper started', () => {
    const s0 = withZe([customer('a', 'wash')]);
    const started = tick(c, s0, T0 + 1);
    const unassigned = ok(assignHelper(started, 'ze', null, T0 + 2));
    const r = ok(collectJob(c, unassigned, 'bay1', T0 + 31_000));
    expect(r.reward).toMatchObject({ coins: 4, tip: 0, timelyBonus: 0 });
  });
});

describe('offline shift', () => {
  const busy = () => withZe([], { nextCustomerAt: T0 + 20_000 });

  it('helpers work until lastActiveAt + 4h, then the garage closes', () => {
    const s = tick(c, busy(), T0 + 10 * HOUR);
    expect(s.idleReport.jobs).toBeGreaterThan(50);
    const job = s.bays[0]!.job;
    if (job) expect(job.startedAt).toBeLessThanOrEqual(T0 + 4 * HOUR);
  });

  it('a 3-day jump earns the same as 4h, and the clock going back does not break', () => {
    const fourH = tick(c, busy(), T0 + 4 * HOUR + 60_000);
    const threeDays = tick(c, busy(), T0 + 72 * HOUR);
    expect(threeDays.idleReport).toEqual(fourH.idleReport);
    const back = tick(c, threeDays, T0 + HOUR);
    expect(back.idleReport).toEqual(threeDays.idleReport);
    expect(back.coins).toBe(threeDays.coins);
  });

  it('is deterministic and fast (8h with two helpers under 50ms)', () => {
    let s = withZe([], { nextCustomerAt: T0 + 20_000, xp: 250, coins: 99999, clockTier: 2 });
    s = ok(hireHelper(c, s, 'bia', T0));
    s = ok(assignHelper(s, 'bia', 'bay2', T0));
    const t = performance.now();
    const a = tick(c, s, T0 + 8 * HOUR);
    expect(performance.now() - t).toBeLessThan(50);
    expect(tick(c, s, T0 + 8 * HOUR)).toEqual(a);
    expect(a.idleReport.jobs).toBeGreaterThan(100);
  });

  it('clearIdleReport resets the report only', () => {
    const s = tick(c, busy(), T0 + HOUR);
    const cleared = clearIdleReport(s);
    expect(cleared.idleReport).toEqual({ jobs: 0, coins: 0, xp: 0 });
    expect(cleared.coins).toBe(s.coins);
  });
});
