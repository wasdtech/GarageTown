import type { BayType, Content } from '@gt/shared';
import { startBuild } from './build';
import { buyCar, buyPart } from './cars';
import { assignHelper, buyClock, hireHelper, trainHelper } from './helpers';
import { tick } from './customers';
import { collectJob, jobProgress, startJob } from './jobs';
import { levelForXp, maxLevel, unlockedJobs } from './levels';
import { buyPerk, openBranch, perkCost, perkLevel } from './prestige';
import { createInitialState, type GameState } from './state';

/** A simulated player: how often they open the game and how long they stay. */
export interface Profile {
  name: string;
  sessionsPerDay: number;
  sessionS: number;
}

export const PROFILES: Profile[] = [
  { name: 'casual', sessionsPerDay: 3, sessionS: 240 },
  { name: 'medio', sessionsPerDay: 6, sessionS: 300 },
  { name: 'intenso', sessionsPerDay: 12, sessionS: 420 },
  { name: 'offline', sessionsPerDay: 2, sessionS: 120 },
];

const DAY_MS = 86_400_000;
const WAKE_START_MS = 8 * 3_600_000;
const WAKE_SPAN_MS = 15 * 3_600_000;
const STEP_MS = 10_000;
/** Bay types the simulated player builds, in slot order. */
const BUILD_PLAN: BayType[] = ['paint', 'performance'];

/** Serves every free bay: a customer whose need fits it, or (when leaving) the longest job it can do. */
function serve(c: Content, s: GameState, now: number, leaving: boolean): GameState {
  const level = levelForXp(c, s.xp);
  for (const bay of s.bays) {
    if (bay.job) continue;
    const fit = s.queue.find((q) => c.jobs.find((j) => j.key === q.need)?.bay === bay.type);
    let pick: { customerId: string; jobKey: string } | null = fit
      ? { customerId: fit.id, jobKey: fit.need }
      : null;
    if (!pick && leaving && s.queue[0]) {
      const longest = unlockedJobs(c, level)
        .filter((j) => j.bay === bay.type)
        .sort((a, b) => b.durationS - a.durationS)[0];
      if (longest) pick = { customerId: s.queue[0].id, jobKey: longest.key };
    }
    if (!pick) continue;
    const r = startJob(c, s, { ...pick, bayId: bay.id }, now);
    if (r.ok) s = r.value;
  }
  return s;
}

/** Order perks are bought in when two next levels cost the same. */
const PERK_ORDER = ['lucro', 'agilidade', 'experiencia', 'paciencia', 'recrutamento'];

/** Spends seals on the cheapest next perk level until none is affordable. */
function buyPerks(c: Content, s: GameState, now: number): GameState {
  for (;;) {
    const options = PERK_ORDER.flatMap((key) => {
      const def = c.prestige.perks.find((p) => p.key === key);
      const level = perkLevel(s, key);
      return def && level < def.max ? [{ key, cost: perkCost(c, key, level + 1) }] : [];
    }).sort((a, b) => a.cost - b.cost);
    const pick = options[0];
    if (!pick || pick.cost > s.prestige.seals) return s;
    const r = buyPerk(c, s, pick.key, now);
    if (!r.ok) return s;
    s = r.value;
  }
}

/** Spends coins like a collector: unlock the next car, then upgrade parts on every car. */
function shop(c: Content, s: GameState, now: number): GameState {
  // helpers first: hire as soon as possible and put each on a bay without a helper (wash first)
  for (const h of c.helpers) {
    const r = hireHelper(c, s, h.key, now);
    if (r.ok) s = r.value;
  }
  for (const h of s.helpers.filter((x) => !x.bayId)) {
    const free = [...s.bays]
      .sort((a) => (a.type === 'wash' ? -1 : 1))
      .find((b) => !s.helpers.some((x) => x.bayId === b.id));
    if (!free) break;
    const r = assignHelper(c, s, h.key, free.id, now);
    if (r.ok) s = r.value;
  }
  for (const m of c.cars) {
    const r = buyCar(c, s, m.key, now);
    if (r.ok) s = r.value;
  }
  for (const car of s.collection.cars) {
    for (const p of c.parts) {
      const r = buyPart(c, s, { carId: car.id, part: p.key }, now);
      if (r.ok) s = r.value;
    }
  }
  const clock = buyClock(c, s, now);
  if (clock.ok) s = clock.value;
  for (const h of s.helpers) {
    const r = trainHelper(c, s, h.key, now);
    if (r.ok) s = r.value;
  }
  return s;
}

/** Simulates `days` of play and returns the day (fractional) each level was reached. */
export function simulate(
  c: Content,
  p: Profile,
  days: number,
  seed = 1,
): { levelDay: Record<number, number>; branchDays: number[]; level12Days: number[]; final: GameState } {
  const t0 = 0;
  let s = createInitialState(c, t0, seed);
  /** Day each level was first reached (first branch). */
  const levelDay: Record<number, number> = { 1: 0 };
  /** Day each branch was opened, and the day level 12 was reached in each branch. */
  const branchDays: number[] = [];
  const level12Days: number[] = [];
  for (let d = 0; d < days; d++) {
    for (let k = 0; k < p.sessionsPerDay; k++) {
      const start = t0 + d * DAY_MS + WAKE_START_MS + (k * WAKE_SPAN_MS) / p.sessionsPerDay;
      for (let now = start; now <= start + p.sessionS * 1000; now += STEP_MS) {
        s = tick(c, s, now);
        for (const bay of s.bays) {
          if (bay.job && jobProgress(bay.job, now).done) {
            const r = collectJob(c, s, bay.id, now);
            if (r.ok) s = r.value.state;
          }
        }
        const nextSlot = c.garage.bays.find(
          (b) =>
            !b.prebuilt &&
            !s.bays.some((x) => x.id === `bay${b.slot}`) &&
            !s.builds.some((x) => x.slot === b.slot),
        );
        if (nextSlot) {
          const type = BUILD_PLAN[c.garage.bays.filter((b) => !b.prebuilt).indexOf(nextSlot)] ?? 'wash';
          const r = startBuild(c, s, { slot: nextSlot.slot, type }, now);
          if (r.ok) s = r.value;
        }
        s = serve(c, s, now, now + STEP_MS > start + p.sessionS * 1000);
        s = shop(c, s, now);
        const lvl = levelForXp(c, s.xp);
        for (let l = 2; l <= lvl; l++) levelDay[l] ??= now / DAY_MS;
        if (lvl >= c.prestige.minLevel) level12Days[s.prestige.branch - 1] ??= now / DAY_MS;
        // a collector opens a new branch at the top level, once every car is in the garage
        if (lvl >= maxLevel(c) && s.collection.cars.length >= c.cars.length) {
          const r = openBranch(c, s, now);
          if (r.ok) {
            s = r.value.state;
            branchDays.push(now / DAY_MS);
          }
        }
        s = buyPerks(c, s, now);
      }
    }
  }
  return { levelDay, branchDays, level12Days, final: s };
}
