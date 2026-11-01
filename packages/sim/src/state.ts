import type { BayType, Content, JobKey } from '@gt/shared';

export interface ActiveJob {
  jobKey: JobKey;
  customerId: string;
  carKey: string;
  need: JobKey;
  startedAt: number;
  durationS: number;
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
}

export interface GameState {
  version: 1;
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
}

export const QUEUE_MAX = 6;
export const ARRIVAL_MS = 20_000;
export const PATIENCE_MS = 120_000;

/** mulberry32: returns a value in [0,1) and the next state. */
export function nextRandom(s: number): [value: number, nextState: number] {
  const t = (s + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t >>> 0];
}

export function createInitialState(_c: Content, now: number, seed: number): GameState {
  return {
    version: 1,
    coins: 0,
    xp: 0,
    reputation: 0,
    bays: [
      { id: 'bay1', type: 'wash', tile: { x: 2, y: 3 }, job: null },
      { id: 'bay2', type: 'mechanic', tile: { x: 5, y: 3 }, job: null },
    ],
    queue: [],
    nextCustomerAt: now + ARRIVAL_MS,
    lastTickAt: now,
    minigameUses: [],
    rngState: seed >>> 0,
    nextId: 1,
  };
}
