import { z } from 'zod';
import brand from '../../../content/brand.json';
import cars from '../../../content/cars.json';
import garage from '../../../content/garage.json';
import looks from '../../../content/looks.json';
import parts from '../../../content/parts.json';
import jobs from '../../../content/jobs.json';
import levels from '../../../content/levels.json';

export const BayTypeSchema = z.enum(['wash', 'mechanic', 'paint', 'performance']);
export type BayType = z.infer<typeof BayTypeSchema>;
export type JobKey = string;

const JobDefSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  bay: BayTypeSchema,
  durationS: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  unlockLevel: z.number().int().positive(),
  /** Sprite name under art/src/icons (also used in the job menu). */
  icon: z.string().min(1),
});
const LevelDefSchema = z.object({ level: z.number().int().positive(), xp: z.number().int().nonnegative() });
const BaySlotSchema = z
  .object({
    slot: z.number().int().positive(),
    tile: z.tuple([z.number().int(), z.number().int()]),
    prebuilt: BayTypeSchema.optional(),
    level: z.number().int().positive().optional(),
    cost: z.number().int().nonnegative().optional(),
    buildS: z.number().int().positive().optional(),
  })
  .refine((b) => b.prebuilt || (b.level && b.cost !== undefined && b.buildS), {
    message: 'a buildable slot needs level, cost and buildS',
  });
const CarDefSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  sprite: z.string().min(1),
  price: z.number().int().nonnegative(),
  unlockLevel: z.number().int().positive(),
  power: z.number().int().positive(),
  grip: z.number().int().positive(),
});
export const StatSchema = z.enum(['power', 'grip']);
const PartDefSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  stat: StatSchema,
  tiers: z
    .array(
      z.object({
        bonus: z.number().int().positive(),
        cost: z.number().int().positive(),
        level: z.number().int().positive(),
      }),
    )
    .min(1),
});
const priced = { key: z.string().min(1), name: z.string().min(1), cost: z.number().int().nonnegative() };
const LooksSchema = z.object({
  paints: z.array(z.object({ ...priced, hex: z.string().regex(/^#[0-9a-f]{6}$/i) })).min(1),
  finishes: z.array(z.object({ ...priced, style: z.number().int().nonnegative() })).min(1),
  neon: z.object({
    name: z.string(),
    cost: z.number().int().nonnegative(),
    unlockLevel: z.number().int().positive(),
    style: z.number().int(),
  }),
  stickers: z.array(z.object({ ...priced, style: z.number().int().nonnegative() })),
  paintStyle: z.number().int().nonnegative(),
});

export const ContentSchema = z
  .object({
    brand: z.object({ name: z.string().min(1) }),
    jobs: z.array(JobDefSchema).min(1),
    levels: z.array(LevelDefSchema).min(1),
    cars: z.array(CarDefSchema).min(1),
    garage: z.object({ bays: z.array(BaySlotSchema).min(1) }),
    parts: z.array(PartDefSchema),
    looks: LooksSchema,
  })
  .superRefine((c, ctx) => {
    c.levels.forEach((l, i) => {
      const prev = c.levels[i - 1];
      if (l.level !== i + 1)
        ctx.addIssue({
          code: 'custom',
          path: ['levels', i, 'level'],
          message: 'levels must be 1..N in order',
        });
      if (prev && l.xp <= prev.xp)
        ctx.addIssue({ code: 'custom', path: ['levels', i, 'xp'], message: 'xp must ascend' });
    });
    if (c.levels[0]?.xp !== 0)
      ctx.addIssue({ code: 'custom', path: ['levels', 0, 'xp'], message: 'level 1 starts at 0 xp' });
    const keys = new Set<string>();
    c.jobs.forEach((j, i) => {
      if (keys.has(j.key))
        ctx.addIssue({ code: 'custom', path: ['jobs', i, 'key'], message: 'duplicate job key' });
      keys.add(j.key);
      if (j.unlockLevel > c.levels.length)
        ctx.addIssue({
          code: 'custom',
          path: ['jobs', i, 'unlockLevel'],
          message: 'unlockLevel above max level',
        });
    });
  });

export type JobDef = z.infer<typeof JobDefSchema>;
export type LevelDef = z.infer<typeof LevelDefSchema>;
export type CarDef = z.infer<typeof CarDefSchema>;
export type BaySlot = z.infer<typeof BaySlotSchema>;
export type PartDef = z.infer<typeof PartDefSchema>;
export type Looks = z.infer<typeof LooksSchema>;
export type Stat = z.infer<typeof StatSchema>;
export type Content = z.infer<typeof ContentSchema>;

export function parseContent(raw: unknown): Content {
  return ContentSchema.parse(raw);
}

export function loadContent(): Content {
  return parseContent({ brand, jobs, levels, cars, garage, parts, looks });
}
