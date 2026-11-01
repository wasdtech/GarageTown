import type { Content } from '@gt/shared';
import { levelForXp, unlockedJobs } from './levels';
import { ARRIVAL_MS, type Customer, type GameState, nextRandom, PATIENCE_MS, QUEUE_MAX } from './state';

/** Advances time: drops impatient customers and spawns pending arrivals (O(QUEUE_MAX), never O(elapsed)). */
export function tick(c: Content, s: GameState, now: number): GameState {
  if (now < s.lastTickAt) return s;
  const queue = s.queue.filter((q) => q.patienceUntil >= now);
  let { rngState, nextId, nextCustomerAt } = s;

  if (now >= nextCustomerAt) {
    const pending = Math.floor((now - nextCustomerAt) / ARRIVAL_MS) + 1;
    const lastArrival = nextCustomerAt + (pending - 1) * ARRIVAL_MS;
    // Arrivals still patient at `now`: arrivedAt + PATIENCE_MS >= now.
    const stillPatient = Math.min(pending, Math.floor((lastArrival + PATIENCE_MS - now) / ARRIVAL_MS) + 1);
    const spawn = Math.max(0, Math.min(stillPatient, QUEUE_MAX - queue.length));
    const jobs = unlockedJobs(c, levelForXp(c, s.xp));
    for (let i = spawn - 1; i >= 0; i--) {
      const arrivedAt = lastArrival - i * ARRIVAL_MS;
      let r: number;
      [r, rngState] = nextRandom(rngState);
      const car = c.cars[Math.floor(r * c.cars.length)]!;
      [r, rngState] = nextRandom(rngState);
      const need = jobs[Math.floor(r * jobs.length)]!;
      const customer: Customer = {
        id: `c${nextId++}`,
        carKey: car.key,
        need: need.key,
        arrivedAt,
        patienceUntil: arrivedAt + PATIENCE_MS,
      };
      queue.push(customer);
    }
    nextCustomerAt += pending * ARRIVAL_MS;
  }

  return { ...s, queue, rngState, nextId, nextCustomerAt, lastTickAt: now };
}
