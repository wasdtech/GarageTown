import { describe, expect, it } from 'vitest';
import { buildProgress, startBuild } from '../src/build';
import { tick } from '../src/customers';
import { deserialize, serialize } from '../src/save';
import { createInitialState, type GameState } from '../src/state';
import { content as c, T0 } from './helpers';

const fresh = (extra: Partial<GameState> = {}): GameState => ({
  ...createInitialState(c, T0, 1),
  nextCustomerAt: Number.MAX_SAFE_INTEGER,
  ...extra,
});

describe('initial bays', () => {
  it('come from the prebuilt garage slots', () => {
    const s = fresh();
    expect(s.version).toBe(6);
    expect(s.bays.map((b) => [b.id, b.type, b.tile.x, b.tile.y])).toEqual([
      ['bay1', 'wash', 2, 3],
      ['bay2', 'mechanic', 5, 3],
    ]);
    expect(s.builds).toEqual([]);
  });
});

describe('startBuild', () => {
  it('needs the slot level', () => {
    expect(startBuild(c, fresh({ coins: 999 }), { slot: 3, type: 'paint' }, T0)).toEqual({
      ok: false,
      error: 'locked',
    });
  });

  it('needs enough coins', () => {
    expect(startBuild(c, fresh({ xp: 60, coins: 149 }), { slot: 3, type: 'paint' }, T0)).toEqual({
      ok: false,
      error: 'no_coins',
    });
  });

  it('charges the cost and starts the construction', () => {
    const r = startBuild(c, fresh({ xp: 60, coins: 200 }), { slot: 3, type: 'paint' }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.coins).toBe(50);
    expect(r.value.builds).toEqual([{ slot: 3, type: 'paint', startedAt: T0, durationS: 120 }]);
  });

  it('rejects taken and unknown slots', () => {
    const r = startBuild(c, fresh({ xp: 60, coins: 999 }), { slot: 3, type: 'paint' }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(startBuild(c, r.value, { slot: 3, type: 'wash' }, T0)).toEqual({ ok: false, error: 'slot_taken' });
    expect(startBuild(c, r.value, { slot: 1, type: 'wash' }, T0)).toEqual({ ok: false, error: 'slot_taken' });
    expect(startBuild(c, r.value, { slot: 9, type: 'wash' }, T0)).toEqual({
      ok: false,
      error: 'unknown_slot',
    });
  });
});

describe('construction completes on tick', () => {
  it('turns into a bay exactly when the timer ends', () => {
    const r = startBuild(c, fresh({ xp: 60, coins: 200 }), { slot: 3, type: 'paint' }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(buildProgress(r.value.builds[0]!, T0 + 60_000)).toEqual({
      done: false,
      remainingMs: 60_000,
      fraction: 0.5,
    });
    expect(tick(c, r.value, T0 + 119_999).bays).toHaveLength(2);
    const done = tick(c, r.value, T0 + 120_000);
    expect(done.builds).toEqual([]);
    expect(done.bays.at(-1)).toEqual({ id: 'bay3', type: 'paint', tile: { x: 2, y: 0 }, job: null });
  });

  it('survives a save/load in the middle of the construction', () => {
    const r = startBuild(c, fresh({ xp: 60, coins: 200 }), { slot: 3, type: 'paint' }, T0);
    if (!r.ok) throw new Error(r.error);
    const loaded = deserialize(c, serialize(r.value), T0 + 200_000, 1);
    expect(loaded.recovered).toBe('ok');
    expect(loaded.state.bays.map((b) => b.id)).toContain('bay3');
  });
});

describe('save v1 migration', () => {
  it('upgrades a v1 save without losing progress', () => {
    const v1 = { ...JSON.parse(serialize(fresh({ coins: 321, xp: 77 }))), version: 1 };
    delete v1.builds;
    const r = deserialize(c, JSON.stringify(v1), T0, 1);
    expect(r.recovered).toBe('ok');
    expect(r.state).toMatchObject({ version: 6, coins: 321, xp: 77, builds: [] });
  });
});
