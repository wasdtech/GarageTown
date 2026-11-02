import type { Content } from '@gt/shared';
import { tick } from './customers';
import { levelForXp } from './levels';
import { err, ok, type Result } from './result';
import { type CarLook, carId, type Collection, type GameState, type OwnedCar, touch } from './state';

export type CarClass = 'D' | 'C' | 'B' | 'A' | 'S';
export interface CarStats {
  power: number;
  grip: number;
  style: number;
  pi: number;
  cls: CarClass;
}

const CLASS_FLOORS: [CarClass, number][] = [
  ['S', 380],
  ['A', 320],
  ['B', 260],
  ['C', 200],
  ['D', 0],
];

export function carStats(c: Content, car: OwnedCar): CarStats {
  const model = c.cars.find((m) => m.key === car.model)!;
  let power = model.power;
  let grip = model.grip;
  for (const [key, tier] of Object.entries(car.parts)) {
    const part = c.parts.find((p) => p.key === key);
    const bonus = part?.tiers[tier - 1]?.bonus ?? 0;
    if (part?.stat === 'power') power += bonus;
    else if (part?.stat === 'grip') grip += bonus;
  }
  const L = c.looks;
  const style =
    (car.look.paint !== L.paints[0]!.key ? L.paintStyle : 0) +
    (L.finishes.find((f) => f.key === car.look.finish)?.style ?? 0) +
    (car.look.neon ? L.neon.style : 0) +
    (car.look.sticker ? (L.stickers.find((x) => x.key === car.look.sticker)?.style ?? 0) : 0);
  const pi = 2 * power + 2 * grip + style;
  const cls = CLASS_FLOORS.find(([, floor]) => pi >= floor)![0];
  return { power, grip, style, pi, cls };
}

function withCar(
  s: GameState,
  id: string,
  f: (car: OwnedCar) => OwnedCar,
  col: Partial<Collection> = {},
): GameState {
  return {
    ...s,
    collection: { ...s.collection, ...col, cars: s.collection.cars.map((x) => (x.id === id ? f(x) : x)) },
  };
}

export type BuyCarError = 'unknown_model' | 'locked' | 'no_coins' | 'owned';

export function buyCar(
  c: Content,
  state: GameState,
  model: string,
  now: number,
): Result<GameState, BuyCarError> {
  const s = tick(c, state, now);
  const def = c.cars.find((m) => m.key === model);
  if (!def) return err('unknown_model');
  if (s.collection.cars.some((x) => x.model === model)) return err('owned');
  if (levelForXp(c, s.xp) < def.unlockLevel) return err('locked');
  if (s.coins < def.price) return err('no_coins');
  const car: OwnedCar = {
    id: carId(model),
    model,
    look: { paint: c.looks.paints[0]!.key, finish: c.looks.finishes[0]!.key, neon: false, sticker: null },
    parts: {},
  };
  return ok(
    touch(
      {
        ...s,
        coins: s.coins - def.price,
        collection: { ...s.collection, cars: [...s.collection.cars, car], activeCarId: car.id },
      },
      now,
    ),
  );
}

export function setActiveCar(s: GameState, id: string): Result<GameState, 'unknown_car'> {
  if (!s.collection.cars.some((x) => x.id === id)) return err('unknown_car');
  return ok({ ...s, collection: { ...s.collection, activeCarId: id } });
}

export type BuyPartError = 'unknown_car' | 'unknown_part' | 'maxed' | 'locked' | 'no_coins';

export function buyPart(
  c: Content,
  state: GameState,
  a: { carId: string; part: string },
  now: number,
): Result<GameState, BuyPartError> {
  const s = tick(c, state, now);
  const car = s.collection.cars.find((x) => x.id === a.carId);
  if (!car) return err('unknown_car');
  const part = c.parts.find((p) => p.key === a.part);
  if (!part) return err('unknown_part');
  const current = car.parts[a.part] ?? 0;
  const tier = part.tiers[current];
  if (!tier) return err('maxed');
  if (levelForXp(c, s.xp) < tier.level) return err('locked');
  if (s.coins < tier.cost) return err('no_coins');
  return ok(
    touch(
      {
        ...withCar(s, car.id, (x) => ({ ...x, parts: { ...x.parts, [a.part]: current + 1 } })),
        coins: s.coins - tier.cost,
      },
      now,
    ),
  );
}

export type LookError = 'unknown_car' | 'unknown_option' | 'locked' | 'no_coins';

/** Applies look changes; options are paid once (first unlock) and are free afterwards. */
export function applyLook(
  c: Content,
  state: GameState,
  a: { carId: string } & Partial<CarLook>,
  now: number,
): Result<GameState, LookError> {
  const s = tick(c, state, now);
  const car = s.collection.cars.find((x) => x.id === a.carId);
  if (!car) return err('unknown_car');
  const L = c.looks;
  const col = { ...s.collection };
  let cost = 0;
  if (a.paint !== undefined) {
    const p = L.paints.find((x) => x.key === a.paint);
    if (!p) return err('unknown_option');
    if (!col.paints.includes(p.key)) {
      cost += p.cost;
      col.paints = [...col.paints, p.key];
    }
  }
  if (a.finish !== undefined) {
    const f = L.finishes.find((x) => x.key === a.finish);
    if (!f) return err('unknown_option');
    if (!col.finishes.includes(f.key)) {
      cost += f.cost;
      col.finishes = [...col.finishes, f.key];
    }
  }
  if (a.sticker !== undefined && a.sticker !== null) {
    const st = L.stickers.find((x) => x.key === a.sticker);
    if (!st) return err('unknown_option');
    if (!col.stickers.includes(st.key)) {
      cost += st.cost;
      col.stickers = [...col.stickers, st.key];
    }
  }
  if (a.neon === true && !col.neon) {
    if (levelForXp(c, s.xp) < L.neon.unlockLevel) return err('locked');
    cost += L.neon.cost;
    col.neon = true;
  }
  if (s.coins < cost) return err('no_coins');
  const look: CarLook = {
    paint: a.paint ?? car.look.paint,
    finish: a.finish ?? car.look.finish,
    neon: a.neon ?? car.look.neon,
    sticker: a.sticker !== undefined ? a.sticker : car.look.sticker,
  };
  return ok(
    touch(
      { ...withCar({ ...s, collection: col }, car.id, (x) => ({ ...x, look })), coins: s.coins - cost },
      now,
    ),
  );
}
