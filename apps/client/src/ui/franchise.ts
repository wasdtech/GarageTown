import type { Content } from '@gt/shared';
import { type GameState, levelForXp, maxLevel, perkCost, perkLevel, sealsFor } from '@gt/sim';
import { S } from './strings';

/** What opening a branch right now would give, and why it can't happen yet. */
export function branchPreview(
  c: Content,
  s: GameState,
): { seals: number; coinsToNext: number; canOpen: boolean; reason: 'level' | 'no_seals' | null } {
  const seals = sealsFor(c, s.prestige.runCoins);
  const coinsToNext = (seals + 1) ** 2 * c.prestige.sealDivisor - s.prestige.runCoins;
  const reason = levelForXp(c, s.xp) < c.prestige.minLevel ? 'level' : seals === 0 ? 'no_seals' : null;
  return { seals, coinsToNext, canOpen: reason === null, reason };
}

/** A perk card's effect now and at the next level, and that level's cost (null at the max). */
export function perkLine(
  c: Content,
  s: GameState,
  key: string,
): { now: string; next: string | null; cost: number | null } {
  const def = c.prestige.perks.find((p) => p.key === key)!;
  const level = perkLevel(s, key);
  const text = (lv: number) => S.franchise.effect[key]!(Math.round(def.effect * lv * 100));
  if (level >= def.max) return { now: text(level), next: null, cost: null };
  return { now: text(level), next: text(level + 1), cost: perkCost(c, key, level + 1) };
}

/**
 * What to celebrate when the level changes. Opening a branch drops the level to 1: that is not a
 * level-up. Crossing the franchise level announces that a new branch can be opened.
 */
export function levelEvents(
  c: Content,
  before: number,
  after: number,
): { levelUp: boolean; franchise: boolean; top: boolean } {
  const levelUp = after > before;
  return {
    levelUp,
    franchise: levelUp && before < c.prestige.minLevel && after >= c.prestige.minLevel,
    // the top level is not the end any more: it points to opening a new branch
    top: levelUp && after >= maxLevel(c),
  };
}
