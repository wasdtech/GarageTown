import type { Content } from '@gt/shared';
import { completeBuilds } from './build';
import { levelForXp, unlockedJobs } from './levels';
import {
  ARRIVAL_MS,
  type Customer,
  type GameState,
  nextRandom,
  PATIENCE_MS,
  QUEUE_MAX,
  VIP_CHANCE,
  VIP_MIN_JOB_LEVEL,
  VIP_MIN_REPUTATION,
  VIP_PATIENCE_MS,
} from './state';

/**
 * Shifts every timestamp back by `gapMs`. Used when the device clock jumps backwards so timers keep
 * their remaining durations: finished jobs stay finished and the game never freezes.
 */
export function rebase(s: GameState, gapMs: number): GameState {
  return {
    ...s,
    lastTickAt: s.lastTickAt - gapMs,
    nextCustomerAt: s.nextCustomerAt - gapMs,
    minigameUses: s.minigameUses.map((t) => t - gapMs),
    builds: s.builds.map((b) => ({ ...b, startedAt: b.startedAt - gapMs })),
    queue: s.queue.map((q) => ({
      ...q,
      arrivedAt: q.arrivedAt - gapMs,
      patienceUntil: q.patienceUntil - gapMs,
    })),
    bays: s.bays.map((b) => (b.job ? { ...b, job: { ...b.job, startedAt: b.job.startedAt - gapMs } } : b)),
  };
}

/** Advances time: drops impatient customers and spawns pending arrivals (O(QUEUE_MAX), never O(elapsed)). */
export function tick(c: Content, state: GameState, now: number): GameState {
  const s = now < state.lastTickAt ? rebase(state, state.lastTickAt - now) : state;
  const queue = s.queue.filter((q) => q.patienceUntil >= now);
  let { rngState, nextId, nextCustomerAt } = s;

  if (now >= nextCustomerAt) {
    const pending = Math.floor((now - nextCustomerAt) / ARRIVAL_MS) + 1;
    const lastArrival = nextCustomerAt + (pending - 1) * ARRIVAL_MS;
    // Arrivals still patient at `now`: arrivedAt + PATIENCE_MS >= now.
    const stillPatient = Math.min(pending, Math.floor((lastArrival + PATIENCE_MS - now) / ARRIVAL_MS) + 1);
    const spawn = Math.max(0, Math.min(stillPatient, QUEUE_MAX - queue.length));
    // customers only ask for jobs the garage can actually do
    const owned = new Set(s.bays.map((b) => b.type));
    const jobs = unlockedJobs(c, levelForXp(c, s.xp)).filter((j) => owned.has(j.bay));
    const vipJobs = jobs.filter((j) => j.unlockLevel >= VIP_MIN_JOB_LEVEL);
    const vipsPossible = s.reputation >= VIP_MIN_REPUTATION && vipJobs.length > 0;
    for (let i = spawn - 1; i >= 0; i--) {
      const arrivedAt = lastArrival - i * ARRIVAL_MS;
      let r: number;
      [r, rngState] = nextRandom(rngState);
      const car = c.cars[Math.floor(r * c.cars.length)]!;
      let vip = false;
      if (vipsPossible) {
        [r, rngState] = nextRandom(rngState);
        vip = r < VIP_CHANCE;
      }
      const pool = vip ? vipJobs : jobs;
      [r, rngState] = nextRandom(rngState);
      const need = pool[Math.floor(r * pool.length)]!;
      const customer: Customer = {
        id: `c${nextId++}`,
        carKey: car.key,
        need: need.key,
        arrivedAt,
        patienceUntil: arrivedAt + (vip ? VIP_PATIENCE_MS : PATIENCE_MS),
        ...(vip ? { vip: true } : {}),
      };
      queue.push(customer);
    }
    nextCustomerAt += pending * ARRIVAL_MS;
  }

  return completeBuilds(c, { ...s, queue, rngState, nextId, nextCustomerAt, lastTickAt: now }, now);
}
