import { BayTypeSchema, type Content } from '@gt/shared';
import { z } from 'zod';
import { tick } from './customers';
import { createInitialState, type GameState } from './state';

const int = z.number().int();
const nonneg = int.nonnegative();

const ActiveJobSchema = z.object({
  jobKey: z.string(),
  customerId: z.string(),
  carKey: z.string(),
  need: z.string(),
  startedAt: int,
  durationS: int.positive(),
});

const GameStateSchema = z.object({
  version: z.literal(1),
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
    z.object({ id: z.string(), carKey: z.string(), need: z.string(), arrivedAt: int, patienceUntil: int }),
  ),
  nextCustomerAt: int,
  lastTickAt: int,
  minigameUses: z.array(int),
  rngState: nonneg,
  nextId: int.positive(),
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
  if (typeof data === 'object' && data !== null && 'version' in data && data.version !== 1) {
    return fresh('unknown_version');
  }
  migrateCarKeys(data);
  const parsed = GameStateSchema.safeParse(data);
  if (!parsed.success) return fresh('corrupt');
  const s = parsed.data as GameState;
  const jobKeys = new Set(c.jobs.map((j) => j.key));
  const carKeys = new Set(c.cars.map((k) => k.key));
  const refsOk =
    s.bays.every((b) => !b.job || (jobKeys.has(b.job.jobKey) && carKeys.has(b.job.carKey))) &&
    s.queue.every((q) => jobKeys.has(q.need) && carKeys.has(q.carKey));
  if (!refsOk) return fresh('corrupt');
  return { state: tick(c, s, now), recovered: 'ok' };
}
