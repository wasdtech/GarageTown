import { describe, expect, it } from 'vitest';
import { applyLook } from '../src/cars';
import { collectJob, startJob } from '../src/jobs';
import { assignHelper, buyClock, hireHelper, shiftEndsAt, trainHelper } from '../src/helpers';
import { deserialize, serialize } from '../src/save';
import { createInitialState, type GameState } from '../src/state';
import { content as c, T0, withCustomer } from './helpers';

const fresh = (extra: Partial<GameState> = {}): GameState => ({
  ...createInitialState(c, T0, 1),
  nextCustomerAt: Number.MAX_SAFE_INTEGER,
  ...extra,
});
const ok = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('state v4', () => {
  it('starts with no helpers, the 4h clock and an empty idle report', () => {
    const s = fresh();
    expect(s.version).toBe(4);
    expect(s.helpers).toEqual([]);
    expect(s.clockTier).toBe(0);
    expect(s.lastActiveAt).toBe(T0);
    expect(s.idleReport).toEqual({ jobs: 0, coins: 0, xp: 0 });
    expect(shiftEndsAt(c, s)).toBe(T0 + 4 * 3_600_000);
  });
});

describe('hireHelper', () => {
  it('checks level, coins and duplicates', () => {
    expect(hireHelper(c, fresh({ coins: 999 }), 'ze', T0)).toEqual({ ok: false, error: 'locked' });
    expect(hireHelper(c, fresh({ xp: 20, coins: 299 }), 'ze', T0)).toEqual({ ok: false, error: 'no_coins' });
    const s = ok(hireHelper(c, fresh({ xp: 20, coins: 400 }), 'ze', T0));
    expect(s.coins).toBe(100);
    expect(s.helpers).toEqual([{ key: 'ze', level: 1, bayId: null }]);
    expect(hireHelper(c, s, 'ze', T0)).toEqual({ ok: false, error: 'hired' });
    expect(hireHelper(c, s, 'robo', T0)).toEqual({ ok: false, error: 'unknown_helper' });
  });
});

describe('trainHelper', () => {
  it('costs 2x/4x/8x/16x the hiring price and stops at level 5', () => {
    let s = ok(hireHelper(c, fresh({ xp: 20, coins: 300 + 600 + 1200 + 2400 + 4800 }), 'ze', T0));
    for (const level of [2, 3, 4, 5]) {
      s = ok(trainHelper(c, s, 'ze', T0));
      expect(s.helpers[0]!.level).toBe(level);
    }
    expect(s.coins).toBe(0);
    expect(trainHelper(c, s, 'ze', T0)).toEqual({ ok: false, error: 'maxed' });
    expect(trainHelper(c, fresh(), 'ze', T0)).toEqual({ ok: false, error: 'not_hired' });
  });
});

describe('assignHelper', () => {
  it('puts one helper per bay and can unassign', () => {
    let s = ok(hireHelper(c, fresh({ xp: 250, coins: 99999 }), 'ze', T0));
    s = ok(hireHelper(c, s, 'bia', T0));
    s = ok(assignHelper(s, 'ze', 'bay1', T0));
    expect(assignHelper(s, 'bia', 'bay1', T0)).toEqual({ ok: false, error: 'bay_has_helper' });
    expect(assignHelper(s, 'bia', 'bay9', T0)).toEqual({ ok: false, error: 'unknown_bay' });
    expect(assignHelper(s, 'tiao', 'bay2', T0)).toEqual({ ok: false, error: 'not_hired' });
    s = ok(assignHelper(s, 'ze', null, T0));
    expect(s.helpers.find((h) => h.key === 'ze')!.bayId).toBeNull();
    expect(ok(assignHelper(s, 'bia', 'bay1', T0)).helpers.find((h) => h.key === 'bia')!.bayId).toBe('bay1');
  });
});

describe('buyClock', () => {
  it('upgrades the shift to 6h then 8h', () => {
    let s = ok(buyClock(c, fresh({ coins: 15000 }), T0));
    expect(s.clockTier).toBe(1);
    expect(shiftEndsAt(c, s)).toBe(T0 + 6 * 3_600_000);
    s = ok(buyClock(c, s, T0));
    expect(s.coins).toBe(0);
    expect(buyClock(c, s, T0)).toEqual({ ok: false, error: 'maxed' });
    expect(buyClock(c, fresh({ coins: 10 }), T0)).toEqual({ ok: false, error: 'no_coins' });
  });
});

describe('player actions refresh lastActiveAt', () => {
  it('start, collect and garage purchases count as activity', () => {
    const s1 = ok(
      startJob(c, withCustomer('wash'), { customerId: 'cx', bayId: 'bay1', jobKey: 'wash' }, T0 + 5_000),
    );
    expect(s1.lastActiveAt).toBe(T0 + 5_000);
    const s2 = ok(collectJob(c, s1, 'bay1', T0 + 40_000)).state;
    expect(s2.lastActiveAt).toBe(T0 + 40_000);
    const s3 = ok(applyLook(c, { ...s2, coins: 500 }, { carId: 'car-pitoco', paint: 'blue' }, T0 + 50_000));
    expect(s3.lastActiveAt).toBe(T0 + 50_000);
  });
});

describe('save v4 migration', () => {
  it('upgrades a v3 save with a job in progress without changing it', () => {
    const r0 = ok(startJob(c, withCustomer('wash'), { customerId: 'cx', bayId: 'bay1', jobKey: 'wash' }, T0));
    const v3 = { ...JSON.parse(serialize(r0)), version: 3 };
    for (const k of ['helpers', 'clockTier', 'lastActiveAt', 'idleReport']) delete v3[k];
    const r = deserialize(c, JSON.stringify(v3), T0 + 31_000, 1);
    expect(r.recovered).toBe('ok');
    expect(r.state).toMatchObject({
      version: 4,
      helpers: [],
      clockTier: 0,
      idleReport: { jobs: 0, coins: 0, xp: 0 },
    });
    expect(ok(collectJob(c, r.state, 'bay1', T0 + 31_000)).reward.coins).toBe(6);
  });
});
