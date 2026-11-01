import type { Content } from '@gt/shared';
import { deserialize, type GameState, type Recovered, serialize } from '@gt/sim';

export const SAVE_KEY = 'gt.save';
export const BACKUP_KEY = 'gt.save.bak';

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export function loadGame(
  c: Content,
  now: number,
  storage: Storage | null = defaultStorage(),
): { state: GameState; recovered: Recovered } {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(SAVE_KEY) ?? null;
  } catch (e) {
    console.warn('gt: could not read save', e);
  }
  const { state, recovered } = deserialize(c, raw, now, randomSeed());
  if ((recovered === 'corrupt' || recovered === 'unknown_version') && raw !== null) {
    try {
      storage?.setItem(BACKUP_KEY, raw);
    } catch (e) {
      console.warn('gt: could not back up save', e);
    }
  }
  return { state, recovered };
}

export function saveGame(s: GameState, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(SAVE_KEY, serialize(s));
  } catch (e) {
    console.warn('gt: could not write save', e);
  }
}
