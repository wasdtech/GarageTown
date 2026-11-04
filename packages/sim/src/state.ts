import type { BayType, Content, JobKey } from '@gt/shared';

export interface ActiveJob {
  jobKey: JobKey;
  customerId: string;
  carKey: string;
  need: JobKey;
  startedAt: number;
  durationS: number;
  vip?: boolean;
  /** Key of the helper who started this job (paid with helper rules). */
  byHelper?: string;
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

export interface CarLook {
  paint: string;
  finish: string;
  neon: boolean;
  sticker: string | null;
}

/** A car the player owns; `parts` maps a part key to its installed tier (1..3). */
export interface OwnedCar {
  id: string;
  model: string;
  look: CarLook;
  parts: Record<string, number>;
}

/** The player's personal garage and the looks they have unlocked. */
export interface Collection {
  cars: OwnedCar[];
  activeCarId: string;
  paints: string[];
  finishes: string[];
  stickers: string[];
  neon: boolean;
}

export const carId = (model: string) => `car-${model}`;

export function starterCollection(c: Content): Collection {
  const model = c.cars[0]!.key;
  return {
    cars: [
      {
        id: carId(model),
        model,
        look: { paint: c.looks.paints[0]!.key, finish: c.looks.finishes[0]!.key, neon: false, sticker: null },
        parts: {},
      },
    ],
    activeCarId: carId(model),
    paints: [c.looks.paints[0]!.key],
    finishes: [c.looks.finishes[0]!.key],
    stickers: [],
    neon: false,
  };
}

export interface HiredHelper {
  key: string;
  level: number;
  bayId: string | null;
}

/** Drag race record: medals per track (0-3), rivals beaten, street race times, races run. */
export interface Race {
  medals: Record<string, number>;
  beaten: string[];
  /** when each street race was run (ms); only the last 24 h matter */
  rachas: number[];
  /** races run so far: part of each race's seed */
  count: number;
  /** a street race started and not settled yet: the stake is already paid */
  pending?: RachaPending;
}

export interface RachaPending {
  racha: 0 | 1 | 2;
  stake: number;
  seed: number;
  power: number;
  grip: number;
}

/** Franchise progress: survives opening a new branch. */
export interface Prestige {
  branch: number;
  seals: number;
  perks: Record<string, number>;
  /** Coins earned (not net of spending) in the current branch. */
  runCoins: number;
}

export interface IdleReport {
  jobs: number;
  coins: number;
  xp: number;
}

export interface GameState {
  version: 6;
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
  collection: Collection;
  helpers: HiredHelper[];
  clockTier: number;
  /** Last player action; helpers keep working until lastActiveAt + shift. */
  lastActiveAt: number;
  idleReport: IdleReport;
  prestige: Prestige;
  race: Race;
}

export const QUEUE_MAX = 6;
export const ARRIVAL_MS = 20_000;
/** A new garage gets its first customer almost immediately (onboarding). */
export const FIRST_CUSTOMER_MS = 2_000;
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
    version: 6,
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
    nextCustomerAt: now + FIRST_CUSTOMER_MS,
    lastTickAt: now,
    minigameUses: [],
    rngState: seed >>> 0,
    nextId: 1,
    builds: [],
    collection: starterCollection(c),
    helpers: [],
    clockTier: 0,
    lastActiveAt: now,
    idleReport: { jobs: 0, coins: 0, xp: 0 },
    prestige: { branch: 1, seals: 0, perks: {}, runCoins: 0 },
    race: { medals: {}, beaten: [], rachas: [], count: 0 },
  };
}

/** Marks player activity (extends the helpers' shift). */
export function touch<T extends GameState>(s: T, now: number): T {
  return now > s.lastActiveAt ? { ...s, lastActiveAt: now } : s;
}
