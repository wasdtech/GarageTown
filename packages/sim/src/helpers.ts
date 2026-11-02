import type { Content } from '@gt/shared';
import { tick } from './customers';
import { levelForXp } from './levels';
import { err, ok, type Result } from './result';
import { type GameState, touch } from './state';

const HOUR_MS = 3_600_000;

export function shiftEndsAt(c: Content, s: GameState): number {
  const tier = c.clockTiers[Math.min(s.clockTier, c.clockTiers.length - 1)]!;
  return s.lastActiveAt + tier.hours * HOUR_MS;
}

export type HireError = 'unknown_helper' | 'hired' | 'locked' | 'no_coins';

export function hireHelper(
  c: Content,
  state: GameState,
  key: string,
  now: number,
): Result<GameState, HireError> {
  const s = tick(c, state, now);
  const def = c.helpers.find((h) => h.key === key);
  if (!def) return err('unknown_helper');
  if (s.helpers.some((h) => h.key === key)) return err('hired');
  if (levelForXp(c, s.xp) < def.unlockLevel) return err('locked');
  if (s.coins < def.price) return err('no_coins');
  return ok(
    touch({ ...s, coins: s.coins - def.price, helpers: [...s.helpers, { key, level: 1, bayId: null }] }, now),
  );
}

export type TrainError = 'unknown_helper' | 'not_hired' | 'maxed' | 'no_coins';

export function trainCost(c: Content, key: string, nextLevel: number): number {
  const def = c.helpers.find((h) => h.key === key)!;
  return def.price * (c.helperLevels[nextLevel - 1]?.trainCostMult ?? 0);
}

export function trainHelper(
  c: Content,
  state: GameState,
  key: string,
  now: number,
): Result<GameState, TrainError> {
  const s = tick(c, state, now);
  if (!c.helpers.some((h) => h.key === key)) return err('unknown_helper');
  const hired = s.helpers.find((h) => h.key === key);
  if (!hired) return err('not_hired');
  if (hired.level >= c.helperLevels.length) return err('maxed');
  const cost = trainCost(c, key, hired.level + 1);
  if (s.coins < cost) return err('no_coins');
  return ok(
    touch(
      {
        ...s,
        coins: s.coins - cost,
        helpers: s.helpers.map((h) => (h.key === key ? { ...h, level: h.level + 1 } : h)),
      },
      now,
    ),
  );
}

export type AssignError = 'not_hired' | 'unknown_bay' | 'bay_has_helper';

export function assignHelper(
  c: Content,
  state: GameState,
  key: string,
  bayId: string | null,
  now: number,
): Result<GameState, AssignError> {
  // settle everything up to now first, so a helper never gets credit for time before it was on the bay
  const s = tick(c, state, now);
  if (!s.helpers.some((h) => h.key === key)) return err('not_hired');
  if (bayId !== null) {
    if (!s.bays.some((b) => b.id === bayId)) return err('unknown_bay');
    if (s.helpers.some((h) => h.key !== key && h.bayId === bayId)) return err('bay_has_helper');
  }
  return ok(touch({ ...s, helpers: s.helpers.map((h) => (h.key === key ? { ...h, bayId } : h)) }, now));
}

export function buyClock(c: Content, state: GameState, now: number): Result<GameState, 'maxed' | 'no_coins'> {
  const s = tick(c, state, now);
  const next = c.clockTiers[s.clockTier + 1];
  if (!next) return err('maxed');
  if (s.coins < next.cost) return err('no_coins');
  return ok(touch({ ...s, coins: s.coins - next.cost, clockTier: s.clockTier + 1 }, now));
}
