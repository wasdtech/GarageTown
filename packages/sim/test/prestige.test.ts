import { describe, expect, it } from 'vitest';
import { tick } from '../src/customers';
import { assignHelper, hireHelper } from '../src/helpers';
import { collectJob, startJob } from '../src/jobs';
import { completeWithMinigame } from '../src/minigame';
import { buyPerk, openBranch, perkCost, sealsFor } from '../src/prestige';
import { createInitialState, type GameState } from '../src/state';
import { content as c, T0, withCustomer } from './helpers';

const ok = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const xpFor = (level: number) => c.levels[level - 1]!.xp;

/** A level-13 garage well into its branch: extra car with parts, a helper, the clock, coins. */
function lateBranch(extra: Partial<GameState> = {}): GameState {
  const s = createInitialState(c, T0, 7);
  return {
    ...s,
    xp: xpFor(13),
    coins: 9000,
    reputation: 30,
    clockTier: 1,
    nextId: 42,
    rngState: 12345,
    nextCustomerAt: Number.MAX_SAFE_INTEGER,
    helpers: [{ key: 'ze', level: 3, bayId: 'bay1' }],
    collection: {
      ...s.collection,
      cars: [
        ...s.collection.cars,
        {
          id: 'car-brutus',
          model: 'brutus_v8',
          look: {
            paint: s.collection.paints[0]!,
            finish: s.collection.finishes[0]!,
            neon: false,
            sticker: null,
          },
          parts: { [c.parts[0]!.key]: 2 },
        },
      ],
    },
    prestige: { branch: 1, seals: 2, perks: { lucro: 1 }, runCoins: 25 * c.prestige.sealDivisor + 100 },
    ...extra,
  };
}

describe('seals', () => {
  it('follow floor(sqrt(runCoins / divisor))', () => {
    const d = c.prestige.sealDivisor;
    expect([d - 1, d, 25 * d, 100 * d, 400 * d].map((n) => sealsFor(c, n))).toEqual([0, 1, 5, 10, 20]);
  });

  it('perk cost grows by step', () => {
    expect(perkCost(c, 'agilidade', 1)).toBe(3);
    expect(perkCost(c, 'agilidade', 3)).toBe(7);
    expect(perkCost(c, 'lucro', 1)).toBe(2);
  });
});

describe('openBranch', () => {
  it('fails below level 12 with level', () => {
    const r = openBranch(c, lateBranch({ xp: xpFor(11) }), T0);
    expect(r).toEqual({ ok: false, error: 'level' });
  });

  it('fails with no_seals when too few coins were earned', () => {
    const r = openBranch(
      c,
      lateBranch({
        xp: xpFor(12),
        prestige: { branch: 1, seals: 0, perks: {}, runCoins: c.prestige.sealDivisor - 1 },
      }),
      T0,
    );
    expect(r).toEqual({ ok: false, error: 'no_seals' });
  });

  it('keeps the cars and perks, resets the rest', () => {
    const before = lateBranch();
    const now = T0 + 1000;
    const r = ok(openBranch(c, before, now));
    expect(r.seals).toBe(5);
    const s = r.state;
    expect(s.prestige).toEqual({ branch: 2, seals: 7, perks: { lucro: 1 }, runCoins: 0 });
    expect(s.collection).toEqual(before.collection);
    expect(s).toMatchObject({
      coins: 0,
      xp: 0,
      reputation: 0,
      helpers: [],
      clockTier: 0,
      builds: [],
      queue: [],
    });
    expect(s.bays).toEqual(createInitialState(c, now, 1).bays);
    expect(s.rngState).toBe(before.rngState);
    expect(s.nextId).toBe(before.nextId);
    expect(s.lastTickAt).toBe(now);
    expect(s.lastActiveAt).toBe(now);
  });

  it('drops running jobs, helpers and the idle report', () => {
    const busy = lateBranch({
      bays: createInitialState(c, T0, 1).bays.map((b) =>
        b.id === 'bay2'
          ? {
              ...b,
              job: {
                jobKey: 'oil',
                customerId: 'z',
                carKey: 'pitoco',
                need: 'oil',
                startedAt: T0 - 999_000,
                durationS: 120,
              },
            }
          : b,
      ),
      idleReport: { jobs: 5, coins: 200, xp: 40 },
    });
    const s = ok(openBranch(c, busy, T0)).state;
    expect(s.bays.every((b) => b.job === null)).toBe(true);
    expect(s.coins).toBe(0);
    expect(s.idleReport).toEqual({ jobs: 0, coins: 0, xp: 0 });
    expect(s.helpers).toEqual([]);
  });

  it('opening twice in a row only pays once', () => {
    const first = ok(openBranch(c, lateBranch(), T0));
    expect(openBranch(c, first.state, T0 + 1)).toEqual({ ok: false, error: 'level' });
  });
});

describe('buyPerk', () => {
  const withSeals = (seals: number, perks: Record<string, number> = {}) =>
    lateBranch({ prestige: { branch: 2, seals, perks, runCoins: 0 } });

  it('spends seals and raises the level', () => {
    const s = ok(buyPerk(c, withSeals(5, { lucro: 2 }), 'lucro', T0));
    expect(s.prestige.perks.lucro).toBe(3);
    expect(s.prestige.seals).toBe(1);
  });

  it('fails when maxed, short of seals, or unknown', () => {
    expect(buyPerk(c, withSeals(99, { recrutamento: 4 }), 'recrutamento', T0)).toEqual({
      ok: false,
      error: 'maxed',
    });
    expect(buyPerk(c, withSeals(2), 'agilidade', T0)).toEqual({ ok: false, error: 'no_seals' });
    expect(buyPerk(c, withSeals(99), 'turbo', T0)).toEqual({ ok: false, error: 'unknown_perk' });
  });
});

describe('runCoins', () => {
  it('counts player, helper and minigame payouts', () => {
    // manual job
    let s = withCustomer('oil');
    s = ok(startJob(c, s, { customerId: 'cx', bayId: 'bay2', jobKey: 'oil' }, T0));
    const manual = ok(collectJob(c, s, 'bay2', T0 + 120_000));
    s = manual.state;
    // minigame
    s = {
      ...s,
      queue: [
        { id: 'cm', carKey: 'pitoco', need: 'wash', arrivedAt: T0 + 120_000, patienceUntil: T0 + 1e12 },
      ],
    };
    s = ok(startJob(c, s, { customerId: 'cm', bayId: 'bay1', jobKey: 'wash' }, T0 + 120_000));
    const mini = ok(completeWithMinigame(c, s, 'bay1', 6000, T0 + 126_000));
    s = mini.state;
    // helper job, collected automatically by the idle engine
    s = { ...s, xp: Math.max(s.xp, xpFor(2)), coins: s.coins + 300 };
    s = ok(hireHelper(c, s, 'ze', T0 + 126_000));
    s = ok(assignHelper(c, s, 'ze', 'bay1', T0 + 126_000));
    s = {
      ...s,
      queue: [
        { id: 'ch', carKey: 'pitoco', need: 'wash', arrivedAt: T0 + 126_000, patienceUntil: T0 + 1e12 },
      ],
    };
    const before = s.prestige.runCoins;
    s = tick(c, s, T0 + 200_000);
    const helperCoins = s.idleReport.coins;
    expect(helperCoins).toBeGreaterThan(0);
    expect(before).toBe(manual.reward.coins + mini.reward.coins);
    expect(s.prestige.runCoins).toBe(before + helperCoins);
  });
});
