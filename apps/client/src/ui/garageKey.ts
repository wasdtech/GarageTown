import type { Content } from '@gt/shared';
import { type GameState, levelForXp, sealsFor } from '@gt/sim';

/**
 * What the garage sheet shows, minus coins: helpers now pay out every few seconds, and a
 * rebuild would flicker the preview and close an open <select>. Purchases still validate coins.
 */
export function garageKey(c: Content, s: GameState): string {
  const p = s.prestige;
  return JSON.stringify([
    levelForXp(c, s.xp),
    s.collection,
    s.helpers,
    s.clockTier,
    s.bays.map((b) => b.id),
    // the franchise tab: branch, seals, perks and the preview's seal count (not the raw coin count)
    [p.branch, p.seals, p.perks, sealsFor(c, p.runCoins)],
  ]);
}
