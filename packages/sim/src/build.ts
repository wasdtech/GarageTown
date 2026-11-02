import type { BayType, Content } from '@gt/shared';
import { tick } from './customers';
import { levelForXp } from './levels';
import { err, ok, type Result } from './result';
import { type Build, bayId, type GameState } from './state';

export type BuildError = 'locked' | 'no_coins' | 'slot_taken' | 'unknown_slot';

/** Starts building a bay of `type` in a garage slot, paying its cost now. */
export function startBuild(
  c: Content,
  state: GameState,
  a: { slot: number; type: BayType },
  now: number,
): Result<GameState, BuildError> {
  const s = tick(c, state, now);
  const def = c.garage.bays.find((b) => b.slot === a.slot);
  if (!def) return err('unknown_slot');
  if (def.prebuilt || s.bays.some((b) => b.id === bayId(a.slot)) || s.builds.some((b) => b.slot === a.slot)) {
    return err('slot_taken');
  }
  if (levelForXp(c, s.xp) < (def.level ?? 1)) return err('locked');
  const cost = def.cost ?? 0;
  if (s.coins < cost) return err('no_coins');
  const build: Build = { slot: a.slot, type: a.type, startedAt: now, durationS: def.buildS ?? 0 };
  return ok({ ...s, coins: s.coins - cost, builds: [...s.builds, build] });
}

export function buildProgress(
  b: Build,
  now: number,
): { done: boolean; remainingMs: number; fraction: number } {
  const total = b.durationS * 1000;
  const elapsed = Math.min(total, Math.max(0, now - b.startedAt));
  return { done: elapsed >= total, remainingMs: total - elapsed, fraction: elapsed / total };
}

/** Turns finished constructions into bays (called from tick). */
export function completeBuilds(c: Content, s: GameState, now: number): GameState {
  const done = s.builds.filter((b) => buildProgress(b, now).done);
  if (done.length === 0) return s;
  const bays = [...s.bays];
  for (const b of done) {
    const def = c.garage.bays.find((d) => d.slot === b.slot);
    if (!def) continue;
    bays.push({ id: bayId(b.slot), type: b.type, tile: { x: def.tile[0], y: def.tile[1] }, job: null });
  }
  bays.sort((x, y) => Number(x.id.slice(3)) - Number(y.id.slice(3)));
  return { ...s, bays, builds: s.builds.filter((b) => !done.includes(b)) };
}
