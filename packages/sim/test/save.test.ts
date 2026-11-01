import { describe, expect, it } from 'vitest';
import { tick } from '../src/customers';
import { jobProgress, startJob } from '../src/jobs';
import { deserialize, serialize } from '../src/save';
import { createInitialState } from '../src/state';
import { content as c, T0, withCustomer } from './helpers';

describe('save', () => {
  it('round-trips a state (ticked to now)', () => {
    const s = tick(c, createInitialState(c, T0, 9), T0 + 45_000);
    const now = T0 + 50_000;
    const r = deserialize(c, serialize(s), now, 1);
    expect(r.recovered).toBe('ok');
    expect(r.state).toEqual(tick(c, s, now));
  });

  it('starts fresh when there is no save', () => {
    const r = deserialize(c, null, T0, 3);
    expect(r.recovered).toBe('missing');
    expect(r.state).toEqual(createInitialState(c, T0, 3));
  });

  it('flags invalid JSON as corrupt', () => {
    expect(deserialize(c, '{oops', T0, 3).recovered).toBe('corrupt');
  });

  it('flags an unknown version', () => {
    expect(deserialize(c, '{"version":99}', T0, 3).recovered).toBe('unknown_version');
  });

  it('flags structurally invalid saves as corrupt', () => {
    const good = JSON.parse(serialize(createInitialState(c, T0, 1)));
    expect(deserialize(c, JSON.stringify({ ...good, coins: -5 }), T0, 1).recovered).toBe('corrupt');
    const noBays = { ...good, bays: undefined };
    expect(deserialize(c, JSON.stringify(noBays), T0, 1).recovered).toBe('corrupt');
    const s = deserialize(c, JSON.stringify({ ...good, coins: -5 }), T0, 1).state;
    expect(s).toEqual(createInitialState(c, T0, 1));
  });

  it('resumes after 10h away: job done, queue rebuilt', () => {
    const r0 = startJob(c, withCustomer('wash'), { customerId: 'cx', bayId: 'bay1', jobKey: 'wash' }, T0);
    if (!r0.ok) throw new Error(r0.error);
    const old = {
      ...r0.value,
      nextCustomerAt: T0 + 20_000,
      queue: [1, 2, 3].map((i) => ({
        id: `old${i}`,
        carKey: 'corisco_rs',
        need: 'oil',
        arrivedAt: T0,
        patienceUntil: T0 + 120_000,
      })),
    };
    const now = T0 + 10 * 3_600_000;
    const r = deserialize(c, serialize(old), now, 1);
    expect(r.recovered).toBe('ok');
    expect(jobProgress(r.state.bays[0]!.job!, now).done).toBe(true);
    expect(r.state.queue).toHaveLength(6);
    expect(r.state.queue.some((q) => q.id.startsWith('old'))).toBe(false);
  });
});

describe('save written with a wrong (future) clock', () => {
  it('keeps playing normally once the clock is corrected', () => {
    const future = T0 + 365 * 86_400_000;
    const s = tick(c, createInitialState(c, future - 60_000, 2), future);
    const r = deserialize(c, serialize(s), T0, 1);
    expect(r.recovered).toBe('ok');
    const after = tick(c, r.state, T0 + 60_000);
    expect(after.lastTickAt).toBe(T0 + 60_000);
    expect(after.queue.length).toBeGreaterThanOrEqual(2);
    for (const q of after.queue) expect(q.patienceUntil).toBeGreaterThan(T0 + 60_000);
  });
});

describe('renamed cars', () => {
  it('migrates old car keys in saves instead of resetting the game', () => {
    const s = { ...withCustomer('wash'), coins: 77 };
    const old = JSON.parse(serialize(s));
    old.queue[0].carKey = 'vespa_gt';
    old.queue.push({ ...old.queue[0], id: 'cz', carKey: 'kumo_86' });
    const r = deserialize(c, JSON.stringify(old), T0, 1);
    expect(r.recovered).toBe('ok');
    expect(r.state.coins).toBe(77);
    expect(r.state.queue.map((q) => q.carKey)).toEqual(['pitoco', 'corisco_rs']);
  });
});
