import type { Content, JobDef } from '@gt/shared';

export function maxLevel(c: Content): number {
  return c.levels.length;
}

export function levelForXp(c: Content, xp: number): number {
  let level = 1;
  for (const l of c.levels) if (xp >= l.xp) level = l.level;
  return level;
}

export function unlockedJobs(c: Content, level: number): JobDef[] {
  return c.jobs.filter((j) => j.unlockLevel <= level);
}
