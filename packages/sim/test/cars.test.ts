import { describe, expect, it } from 'vitest';
import { applyLook, buyCar, buyPart, carStats, setActiveCar } from '../src/cars';
import { deserialize, serialize } from '../src/save';
import { createInitialState, type GameState } from '../src/state';
import { content as c, T0 } from './helpers';

const fresh = (extra: Partial<GameState> = {}): GameState => ({
  ...createInitialState(c, T0, 1),
  nextCustomerAt: Number.MAX_SAFE_INTEGER,
  ...extra,
});
const ok = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('starting garage', () => {
  it('has the gift Pitoco, red and matte, as the showcase car', () => {
    const g = fresh().collection;
    expect(g.cars).toEqual([
      {
        id: 'car-pitoco',
        model: 'pitoco',
        look: { paint: 'red', finish: 'matte', neon: false, sticker: null },
        parts: {},
      },
    ]);
    expect(g.activeCarId).toBe('car-pitoco');
    expect(g.paints).toEqual(['red']);
    expect(g.finishes).toEqual(['matte']);
  });
});

describe('carStats', () => {
  it('computes PI and class from model, parts and looks', () => {
    const car = fresh().collection.cars[0]!;
    expect(carStats(c, car)).toEqual({ power: 40, grip: 50, style: 0, pi: 180, cls: 'D' });
    const tuned = {
      ...car,
      parts: { engine: 2, tires: 1 },
      look: { paint: 'blue', finish: 'pearl', neon: true, sticker: 'bolt' },
    };
    // power 40+20, grip 50+10, style 10 paint + 20 pearl + 15 neon + 10 sticker
    expect(carStats(c, tuned)).toEqual({ power: 60, grip: 60, style: 55, pi: 295, cls: 'B' });
  });
});

describe('buyCar', () => {
  it('checks level and coins, then adds the car and shows it', () => {
    expect(buyCar(c, fresh({ coins: 99999 }), 'brutus_v8', T0)).toEqual({ ok: false, error: 'locked' });
    expect(buyCar(c, fresh({ xp: 250, coins: 2999 }), 'brutus_v8', T0)).toEqual({
      ok: false,
      error: 'no_coins',
    });
    const s = ok(buyCar(c, fresh({ xp: 250, coins: 3500 }), 'brutus_v8', T0));
    expect(s.coins).toBe(500);
    expect(s.collection.cars.map((x) => x.id)).toEqual(['car-pitoco', 'car-brutus_v8']);
    expect(s.collection.activeCarId).toBe('car-brutus_v8');
    expect(buyCar(c, s, 'brutus_v8', T0)).toEqual({ ok: false, error: 'owned' });
    expect(buyCar(c, s, 'hovercar', T0)).toEqual({ ok: false, error: 'unknown_model' });
  });

  it('can switch the showcase car', () => {
    const s = ok(buyCar(c, fresh({ xp: 250, coins: 3500 }), 'brutus_v8', T0));
    expect(ok(setActiveCar(s, 'car-pitoco')).collection.activeCarId).toBe('car-pitoco');
    expect(setActiveCar(s, 'car-nope')).toEqual({ ok: false, error: 'unknown_car' });
  });
});

describe('buyPart', () => {
  it('upgrades one tier at a time with level and coin checks', () => {
    expect(buyPart(c, fresh({ coins: 9999 }), { carId: 'car-pitoco', part: 'engine' }, T0)).toEqual({
      ok: false,
      error: 'locked',
    });
    const s1 = ok(buyPart(c, fresh({ xp: 20, coins: 600 }), { carId: 'car-pitoco', part: 'engine' }, T0));
    expect(s1.coins).toBe(100);
    expect(s1.collection.cars[0]!.parts).toEqual({ engine: 1 });
    expect(buyPart(c, s1, { carId: 'car-pitoco', part: 'engine' }, T0)).toEqual({
      ok: false,
      error: 'locked',
    });
    const maxed = fresh({ xp: 9999, coins: 0 });
    maxed.collection.cars[0]!.parts = { engine: 3 };
    expect(buyPart(c, maxed, { carId: 'car-pitoco', part: 'engine' }, T0)).toEqual({
      ok: false,
      error: 'maxed',
    });
    expect(buyPart(c, s1, { carId: 'car-pitoco', part: 'wings' }, T0)).toEqual({
      ok: false,
      error: 'unknown_part',
    });
  });
});

describe('applyLook', () => {
  it('charges a paint once, then it is free to reuse', () => {
    const s1 = ok(applyLook(c, fresh({ coins: 200 }), { carId: 'car-pitoco', paint: 'blue' }, T0));
    expect(s1.coins).toBe(50);
    expect(s1.collection.paints).toEqual(['red', 'blue']);
    const s2 = ok(applyLook(c, s1, { carId: 'car-pitoco', paint: 'red' }, T0));
    const s3 = ok(applyLook(c, s2, { carId: 'car-pitoco', paint: 'blue' }, T0));
    expect(s3.coins).toBe(50);
    expect(s3.collection.cars[0]!.look.paint).toBe('blue');
  });

  it('gates neon by level and supports removing a sticker', () => {
    expect(applyLook(c, fresh({ coins: 9999 }), { carId: 'car-pitoco', neon: true }, T0)).toEqual({
      ok: false,
      error: 'locked',
    });
    const s = ok(
      applyLook(c, fresh({ xp: 420, coins: 3200 }), { carId: 'car-pitoco', neon: true, sticker: 'star' }, T0),
    );
    expect(s.coins).toBe(100);
    expect(s.collection.cars[0]!.look).toMatchObject({ neon: true, sticker: 'star' });
    const off = ok(applyLook(c, s, { carId: 'car-pitoco', sticker: null, neon: false }, T0));
    expect(off.coins).toBe(100);
    expect(off.collection.cars[0]!.look).toMatchObject({ neon: false, sticker: null });
  });

  it('rejects unknown options and missing coins', () => {
    expect(applyLook(c, fresh(), { carId: 'car-pitoco', paint: 'gold' }, T0)).toEqual({
      ok: false,
      error: 'unknown_option',
    });
    expect(applyLook(c, fresh({ coins: 10 }), { carId: 'car-pitoco', finish: 'pearl' }, T0)).toEqual({
      ok: false,
      error: 'no_coins',
    });
  });
});

describe('save v3', () => {
  it('migrates a v2 save by giving the player the Pitoco', () => {
    const v2 = { ...JSON.parse(serialize(fresh({ coins: 42 }))), version: 2 };
    delete v2.collection;
    const r = deserialize(c, JSON.stringify(v2), T0, 1);
    expect(r.recovered).toBe('ok');
    expect(r.state.version).toBe(4);
    expect(r.state.coins).toBe(42);
    expect(r.state.collection.activeCarId).toBe('car-pitoco');
  });

  it('round-trips a customised garage', () => {
    const s = ok(applyLook(c, fresh({ coins: 200 }), { carId: 'car-pitoco', paint: 'blue' }, T0));
    expect(deserialize(c, serialize(s), T0, 1).state.collection).toEqual(s.collection);
  });
});
