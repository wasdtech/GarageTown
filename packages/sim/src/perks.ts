import type { Content } from '@gt/shared';
import type { GameState } from './state';

/** Perk levels and their effects. Dependency-free so rules anywhere in the sim can apply them. */
export function perkLevel(s: GameState, key: string): number {
  return s.prestige.perks[key] ?? 0;
}

/** The perk's total effect at its current level (e.g. 0.2 for lucro level 2). */
export function perkFactor(c: Content, s: GameState, key: string): number {
  const def = c.prestige.perks.find((p) => p.key === key);
  return def ? def.effect * perkLevel(s, key) : 0;
}

/** Job coins with lucro (applied after the VIP double and the helper share). */
export function boostCoins(c: Content, s: GameState, n: number): number {
  return Math.floor(n * (1 + perkFactor(c, s, 'lucro')));
}

export function boostXp(c: Content, s: GameState, n: number): number {
  return Math.floor(n * (1 + perkFactor(c, s, 'experiencia')));
}

/** Duration of a job starting now, with agilidade on top of a helper's training speed. */
export function boostDuration(c: Content, s: GameState, durationS: number, speed = 1): number {
  return Math.max(1, Math.round(durationS * speed * (1 - perkFactor(c, s, 'agilidade'))));
}

export function boostPatience(c: Content, s: GameState, ms: number): number {
  return Math.round(ms * (1 + perkFactor(c, s, 'paciencia')));
}

/** Helper hire/training price with recrutamento. */
export function recruitPrice(c: Content, s: GameState, price: number): number {
  return Math.ceil(price * (1 - perkFactor(c, s, 'recrutamento')));
}
