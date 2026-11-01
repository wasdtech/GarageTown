import type { BayType, Content, JobKey } from '@gt/shared';

export interface ActiveJob {
  jobKey: JobKey;
  customerId: string;
  carKey: string;
  need: JobKey;
  startedAt: number;
  durationS: number;
  vip?: boolean;
}

export interface Bay {
  id: string;
  type: BayType;
  tile: { x: number; y: number };
  job: ActiveJob | null;
}

export interface Customer {
  id: string;
  carKey: string;
  need: JobKey;
  arrivedAt: number;
  patienceUntil: number;
  /** VIP customers pay double and ask for higher-level jobs. */
  vip?: boolean;
}

/** A bay under construction in a garage slot. */
export interface Build {
  slot: number;
  type: BayType;
  startedAt: number;
  durationS: number;
}

export interface GameState {
  version: 2;
  coins: number;
  xp: number;
  reputation: number;
  bays: Bay[];
  queue: Customer[];
  nextCustomerAt: number;
  lastTickAt: number;
  /** Timestamps (ms) of minigame completions within the last hour. */
  minigameUses: number[];
  rngState: number;
  nextId: number;
  builds: Build[];
}

export const QUEUE_MAX = 6;
export const ARRIVAL_MS = 20_000;
export const PATIENCE_MS = 120_000;
export const VIP_PATIENCE_MS = 240_000;
export const VIP_MIN_REPUTATION = 10;
export const VIP_CHANCE = 0.1;
export const VIP_MIN_JOB_LEVEL = 4;
export const VIP_COIN_MULTIPLIER = 2;

/** mulberry32: returns a value in [0,1) and the next state. */
export function nextRandom(s: number): [value: number, nextState: number] {
  const t = (s + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t >>> 0];
}

export const bayId = (slot: number) => `bay${slot}`;

export function createInitialState(c: Content, now: number, seed: number): GameState {
  return {
    version: 2,
    coins: 0,
    xp: 0,
    reputation: 0,
    bays: c.garage.bays
      .filter((b) => b.prebuilt)
      .map((b) => ({
        id: bayId(b.slot),
        type: b.prebuilt!,
        tile: { x: b.tile[0], y: b.tile[1] },
        job: null,
      })),
    queue: [],
    nextCustomerAt: now + ARRIVAL_MS,
    lastTickAt: now,
    minigameUses: [],
    rngState: seed >>> 0,
    nextId: 1,
    builds: [],
  };
}
