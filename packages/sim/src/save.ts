import { BayTypeSchema, type Content } from '@gt/shared';
import { z } from 'zod';
import { tick } from './customers';
import { createInitialState, type GameState, starterCollection } from './state';

const int = z.number().int();
const nonneg = int.nonnegative();

const ActiveJobSchema = z.object({
  jobKey: z.string(),
  customerId: z.string(),
  carKey: z.string(),
  need: z.string(),
  startedAt: int,
  durationS: int.positive(),
  vip: z.boolean().optional(),
  byHelper: z.string().optional(),
});

const CollectionSchema = z.object({
  cars: z
    .array(
      z.object({
        id: z.string(),
        model: z.string(),
        look: z.object({
          paint: z.string(),
          finish: z.string(),
          neon: z.boolean(),
          sticker: z.string().nullable(),
        }),
        parts: z.record(z.string(), int.min(1).max(3)),
      }),
    )
    .min(1),
  activeCarId: z.string(),
  paints: z.array(z.string()),
  finishes: z.array(z.string()),
  stickers: z.array(z.string()),
  neon: z.boolean(),
});

const GameStateSchema = z.object({
  version: z.literal(6),
  race: z.object({
    medals: z.record(z.string(), int.min(0).max(3)),
    beaten: z.array(z.string()),
    rachas: z.array(int),
    count: nonneg,
  }),
  prestige: z.object({
    branch: int.min(1),
    seals: nonneg,
    perks: z.record(z.string(), nonneg),
    runCoins: nonneg,
  }),
  helpers: z.array(z.object({ key: z.string(), level: int.min(1).max(5), bayId: z.string().nullable() })),
  clockTier: int.min(0),
  lastActiveAt: int,
  idleReport: z.object({ jobs: nonneg, coins: nonneg, xp: nonneg }),
  coins: nonneg,
  xp: nonneg,
  reputation: nonneg,
  bays: z
    .array(
      z.object({
        id: z.string(),
        type: BayTypeSchema,
        tile: z.object({ x: int, y: int }),
        job: ActiveJobSchema.nullable(),
      }),
    )
    .min(1),
  queue: z.array(
    z.object({
      id: z.string(),
      carKey: z.string(),
      need: z.string(),
      arrivedAt: int,
      patienceUntil: int,
      vip: z.boolean().optional(),
    }),
  ),
  nextCustomerAt: int,
  lastTickAt: int,
  minigameUses: z.array(int),
  rngState: nonneg,
  nextId: int.positive(),
  collection: CollectionSchema,
  builds: z.array(
    z.object({ slot: int.positive(), type: BayTypeSchema, startedAt: int, durationS: int.positive() }),
  ),
});

/** Old car keys from earlier builds, mapped to their current keys so saves keep loading. */
const CAR_KEY_ALIASES: Record<string, string> = { vespa_gt: 'pitoco', kumo_86: 'corisco_rs' };

function migrateCarKeys(data: unknown): void {
  if (typeof data !== 'object' || data === null) return;
  const d = data as { queue?: { carKey?: string }[]; bays?: { job?: { carKey?: string } | null }[] };
  const fix = (o?: { carKey?: string } | null) => {
    if (o?.carKey && CAR_KEY_ALIASES[o.carKey]) o.carKey = CAR_KEY_ALIASES[o.carKey];
  };
  if (Array.isArray(d.queue)) d.queue.forEach(fix);
  if (Array.isArray(d.bays)) d.bays.forEach((b) => fix(b?.job));
}

export type Recovered = 'ok' | 'missing' | 'corrupt' | 'unknown_version';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

/** Restores a save, falling back to a fresh game on any problem. Never throws. */
export function deserialize(
  c: Content,
  raw: string | null,
  now: number,
  seed: number,
): { state: GameState; recovered: Recovered } {
  const fresh = (recovered: Recovered) => ({ state: createInitialState(c, now, seed), recovered });
  if (raw === null) return fresh('missing');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fresh('corrupt');
  }
  if (typeof data === 'object' && data !== null && 'version' in data) {
    const d = data as {
      version: unknown;
      builds?: unknown;
      collection?: unknown;
      helpers?: unknown;
      clockTier?: unknown;
      lastActiveAt?: unknown;
      lastTickAt?: unknown;
      idleReport?: unknown;
      prestige?: unknown;
      race?: unknown;
    };
    if (d.version === 1) {
      // v1 -> v2: construction queue added
      d.version = 2;
      d.builds = [];
    }
    if (d.version === 2) {
      // v2 -> v3: personal garage, starting with the gift car
      d.version = 3;
      d.collection = starterCollection(c);
    }
    if (d.version === 3) {
      // v3 -> v4: helpers, shift clock and idle report
      d.version = 4;
      d.helpers = [];
      d.clockTier = 0;
      d.lastActiveAt = d.lastTickAt;
      d.idleReport = { jobs: 0, coins: 0, xp: 0 };
    }
    if (d.version === 4) {
      // v4 -> v5: franchise (prestige) progress, starting at branch 1
      d.version = 5;
      d.prestige = { branch: 1, seals: 0, perks: {}, runCoins: 0 };
    }
    if (d.version === 5) {
      // v5 -> v6: drag race record
      d.version = 6;
      d.race = { medals: {}, beaten: [], rachas: [], count: 0 };
    } else if (d.version !== 6) {
      return fresh('unknown_version');
    }
  }
  migrateCarKeys(data);
  const parsed = GameStateSchema.safeParse(data);
  if (!parsed.success) return fresh('corrupt');
  const s = parsed.data as GameState;
  const jobKeys = new Set(c.jobs.map((j) => j.key));
  const carKeys = new Set(c.cars.map((k) => k.key));
  const refsOk =
    s.bays.every((b) => !b.job || (jobKeys.has(b.job.jobKey) && carKeys.has(b.job.carKey))) &&
    s.queue.every((q) => jobKeys.has(q.need) && carKeys.has(q.carKey)) &&
    s.collection.cars.every((car) => carKeys.has(car.model)) &&
    s.collection.cars.some((car) => car.id === s.collection.activeCarId) &&
    s.collection.paints.every((p) => c.looks.paints.some((x) => x.key === p));
  if (!refsOk) return fresh('corrupt');
  // perks: unknown keys (removed from content) are dropped; a level above the max is tampering
  const perks: Record<string, number> = {};
  for (const [key, level] of Object.entries(s.prestige.perks)) {
    const def = c.prestige.perks.find((p) => p.key === key);
    if (!def) continue;
    if (level > def.max) return fresh('corrupt');
    perks[key] = level;
  }
  // race: tracks no longer in the content are dropped
  const tracks = new Set(c.race.tracks.map((t) => t.key));
  const race = {
    ...s.race,
    medals: Object.fromEntries(Object.entries(s.race.medals).filter(([k]) => tracks.has(k))),
    beaten: s.race.beaten.filter((k) => tracks.has(k)),
  };
  return { state: tick(c, { ...s, prestige: { ...s.prestige, perks }, race }, now), recovered: 'ok' };
}
