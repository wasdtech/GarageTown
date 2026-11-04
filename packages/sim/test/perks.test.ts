import { describe, expect, it } from 'vitest';
import { makeCustomer, tick } from '../src/customers';
import { assignHelper, hireHelper, trainCost } from '../src/helpers';
import { type ActiveJob, createInitialState, type GameState } from '../src/state';
import { collectJob, helperReward, startJob } from '../src/jobs';
import { buyPerk } from '../src/prestige';
import { content as c, T0, withCustomer } from './helpers';

const ok = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const withPerks = (s: GameState, perks: Record<string, number>, seals = 0): GameState => ({
  ...s,
  prestige: { ...s.prestige, perks, seals },
});
const oilJob = (extra: Partial<ActiveJob> = {}): ActiveJob => ({
  jobKey: 'oil',
  customerId: 'x',
  carKey: 'pitoco',
  need: 'oil',
  startedAt: T0,
  durationS: 120,
  ...extra,
});

describe('lucro', () => {
  it('boosts the job coins, not the tip or the timely bonus', () => {
    let s = withPerks(withCustomer('oil'), { lucro: 2 });
    s = ok(startJob(c, s, { customerId: 'cx', bayId: 'bay2', jobKey: 'oil' }, T0));
    // floor(15 * 1.2) + floor(15 * 0.2) + floor(15 * 0.1) = 18 + 3 + 1
    expect(ok(collectJob(c, s, 'bay2', T0 + 120_000)).reward.coins).toBe(22);
  });

  it('applies after the VIP double and the helper share', () => {
    const s = withPerks(createInitialState(c, T0, 1), { lucro: 1 });
    // floor(floor(30 * 0.8) * 1.1) = floor(26.4)
    expect(helperReward(c, s, oilJob({ vip: true }), { level: 1 }).coins).toBe(26);
  });
});

describe('experiencia', () => {
  it('boosts the XP of a job', () => {
    let s = withPerks(withCustomer('oil'), { experiencia: 3 });
    s = ok(startJob(c, s, { customerId: 'cx', bayId: 'bay2', jobKey: 'oil' }, T0));
    // oil pays 12 XP; +30% is 15.6, rounded down
    expect(ok(collectJob(c, s, 'bay2', T0 + 120_000)).reward.xp).toBe(15);
  });
});

describe('agilidade', () => {
  it('shortens new manual jobs', () => {
    let s = withPerks(withCustomer('oil'), { agilidade: 2 });
    s = ok(startJob(c, s, { customerId: 'cx', bayId: 'bay2', jobKey: 'oil' }, T0));
    expect(s.bays.find((b) => b.id === 'bay2')!.job!.durationS).toBe(108);
  });

  it('stacks with a trained helper and with the wash minimum', () => {
    let s: GameState = {
      ...withPerks(createInitialState(c, T0, 1), { agilidade: 2 }),
      xp: 20,
      coins: 300,
      nextCustomerAt: Number.MAX_SAFE_INTEGER,
    };
    s = ok(hireHelper(c, s, 'ze', T0));
    s = ok(assignHelper(c, s, 'ze', 'bay2', T0));
    s = {
      ...s,
      helpers: s.helpers.map((h) => ({ ...h, level: 5 })),
      queue: [{ id: 'q', carKey: 'pitoco', need: 'oil', arrivedAt: T0, patienceUntil: T0 + 1e12 }],
    };
    s = tick(c, s, T0 + 1);
    // max(1, round(120 * 0.72 * 0.9)) = 78
    expect(s.bays.find((b) => b.id === 'bay2')!.job!.durationS).toBe(78);

    let w = withPerks(withCustomer('wash'), { agilidade: 6 });
    w = ok(startJob(c, w, { customerId: 'cx', bayId: 'bay1', jobKey: 'wash' }, T0));
    expect(w.bays.find((b) => b.id === 'bay1')!.job!.durationS).toBe(21);
  });

  it('agilidade does not change a running job', () => {
    let s = withPerks(withCustomer('oil'), {}, 10);
    s = ok(startJob(c, s, { customerId: 'cx', bayId: 'bay2', jobKey: 'oil' }, T0));
    s = ok(buyPerk(c, s, 'agilidade', T0 + 1000));
    expect(s.prestige.perks.agilidade).toBe(1);
    expect(s.bays.find((b) => b.id === 'bay2')!.job!.durationS).toBe(120);
  });
});

describe('paciencia', () => {
  it('new customers wait longer; customers already waiting keep their patience', () => {
    const s = withPerks(createInitialState(c, T0, 1), { paciencia: 2 });
    const { customer } = makeCustomer(c, s, T0);
    expect(customer.patienceUntil - customer.arrivedAt).toBe(156_000);
    const plain = makeCustomer(c, createInitialState(c, T0, 1), T0).customer;
    expect(plain.patienceUntil - plain.arrivedAt).toBe(120_000);
  });
});

describe('recrutamento', () => {
  it('makes hiring and training cheaper', () => {
    const s: GameState = {
      ...withPerks(createInitialState(c, T0, 1), { recrutamento: 1 }),
      xp: 20,
      coins: 300,
    };
    expect(ok(hireHelper(c, s, 'ze', T0)).coins).toBe(300 - 255);
    expect(trainCost(c, s, 'ze', 2)).toBe(510);
    expect(trainCost(c, createInitialState(c, T0, 1), 'ze', 2)).toBe(600);
  });
});
