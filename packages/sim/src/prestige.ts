import type { Content } from '@gt/shared';
import { tick } from './customers';
import { levelForXp } from './levels';
import { perkLevel } from './perks';
import { err, ok, type Result } from './result';
import { createInitialState, type GameState, touch } from './state';

/** Seals a branch is worth: grows with the square root of the coins earned in it. */
export function sealsFor(c: Content, runCoins: number): number {
  return Math.floor(Math.sqrt(runCoins / c.prestige.sealDivisor));
}

/** Seals needed to raise `key` to `nextLevel`. */
export function perkCost(c: Content, key: string, nextLevel: number): number {
  const def = c.prestige.perks.find((p) => p.key === key)!;
  return def.baseCost + def.step * (nextLevel - 1);
}

export * from './perks';

export type BranchError = 'level' | 'no_seals';

/** Opens a new branch: the garage starts over; cars, seals and perks carry on. */
export function openBranch(
  c: Content,
  state: GameState,
  now: number,
): Result<{ state: GameState; seals: number }, BranchError> {
  const s = tick(c, state, now);
  if (levelForXp(c, s.xp) < c.prestige.minLevel) return err('level');
  const seals = sealsFor(c, s.prestige.runCoins);
  if (seals === 0) return err('no_seals');
  const fresh = createInitialState(c, now, 0);
  return ok({
    state: touch(
      {
        ...fresh,
        collection: s.collection,
        rngState: s.rngState,
        nextId: s.nextId,
        // the trophy cabinet goes with the player, like the cars
        race: s.race,
        prestige: {
          branch: s.prestige.branch + 1,
          seals: s.prestige.seals + seals,
          perks: s.prestige.perks,
          runCoins: 0,
        },
      },
      now,
    ),
    seals,
  });
}

export type PerkError = 'unknown_perk' | 'maxed' | 'no_seals';

export function buyPerk(
  c: Content,
  state: GameState,
  key: string,
  now: number,
): Result<GameState, PerkError> {
  const s = tick(c, state, now);
  const def = c.prestige.perks.find((p) => p.key === key);
  if (!def) return err('unknown_perk');
  const level = perkLevel(s, key);
  if (level >= def.max) return err('maxed');
  const cost = perkCost(c, key, level + 1);
  if (s.prestige.seals < cost) return err('no_seals');
  return ok(
    touch(
      {
        ...s,
        prestige: {
          ...s.prestige,
          seals: s.prestige.seals - cost,
          perks: { ...s.prestige.perks, [key]: level + 1 },
        },
      },
      now,
    ),
  );
}
