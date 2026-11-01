import { z } from 'zod';
import brand from '../../../content/brand.json';
import cars from '../../../content/cars.json';
import jobs from '../../../content/jobs.json';
import levels from '../../../content/levels.json';

export const BayTypeSchema = z.enum(['wash', 'mechanic']);
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
const CarDefSchema = z.object({ key: z.string().min(1), name: z.string().min(1), sprite: z.string().min(1) });

export const ContentSchema = z
  .object({
    brand: z.object({ name: z.string().min(1) }),
    jobs: z.array(JobDefSchema).min(1),
    levels: z.array(LevelDefSchema).min(1),
    cars: z.array(CarDefSchema).min(1),
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
export type Content = z.infer<typeof ContentSchema>;

export function parseContent(raw: unknown): Content {
  return ContentSchema.parse(raw);
}

export function loadContent(): Content {
  return parseContent({ brand, jobs, levels, cars });
}
