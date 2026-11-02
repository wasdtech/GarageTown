import type { Content } from '@gt/shared';
import { makeCustomer } from './customers';
import { applyReward, helperReward } from './jobs';
import { ARRIVAL_MS, type GameState, QUEUE_MAX } from './state';

const MAX_EVENTS = 10_000;

const doneAt = (j: { startedAt: number; durationS: number }) => j.startedAt + j.durationS * 1000;

/** Bays a helper currently works on, with that helper. */
function helperBays(s: GameState) {
  return s.bays.flatMap((b) => {
    const h = s.helpers.find((x) => x.bayId === b.id);
    return h ? [{ bay: b, helper: h }] : [];
  });
}

/** Each free helper bay takes the oldest waiting customer whose need fits the bay. */
function assignWork(c: Content, s: GameState, t: number): GameState {
  for (const { bay, helper } of helperBays(s)) {
    if (bay.job) continue;
    const customer = s.queue.find((q) => c.jobs.find((j) => j.key === q.need)?.bay === bay.type);
    if (!customer) continue;
    const def = c.jobs.find((j) => j.key === customer.need)!;
    const speed = c.helperLevels[helper.level - 1]?.speed ?? 1;
    const job = {
      jobKey: def.key,
      customerId: customer.id,
      carKey: customer.carKey,
      need: customer.need,
      startedAt: t,
      durationS: Math.max(1, Math.round(def.durationS * speed)),
      byHelper: helper.key,
      ...(customer.vip ? { vip: true } : {}),
    };
    s = {
      ...s,
      queue: s.queue.filter((q) => q.id !== customer.id),
      bays: s.bays.map((b) => (b.id === bay.id ? { ...b, job } : b)),
    };
  }
  return s;
}

/**
 * Replays arrivals and helper work event by event from lastTickAt up to `until` (pure, deterministic).
 * Helpers collect their finished jobs at the exact moment they finish and pick the next customer.
 */
export function runHelpers(c: Content, state: GameState, until: number): GameState {
  let s = assignWork(c, state, state.lastTickAt);
  for (let i = 0; i < MAX_EVENTS; i++) {
    const finishing = helperBays(s).filter(({ bay }) => bay.job?.byHelper);
    const nextDone = Math.min(...finishing.map(({ bay }) => doneAt(bay.job!)));
    const t = Math.min(s.nextCustomerAt, nextDone);
    if (!(t <= until)) break;
    s = { ...s, queue: s.queue.filter((q) => q.patienceUntil >= t) };
    for (const { bay, helper } of finishing) {
      if (doneAt(bay.job!) !== t) continue;
      const reward = helperReward(c, s, bay.job!, helper);
      s = applyReward(s, bay.id, reward);
      s = {
        ...s,
        idleReport: {
          jobs: s.idleReport.jobs + 1,
          coins: s.idleReport.coins + reward.coins,
          xp: s.idleReport.xp + reward.xp,
        },
      };
    }
    if (s.nextCustomerAt === t) {
      if (s.queue.length < QUEUE_MAX) {
        const made = makeCustomer(c, s, t);
        s = { ...s, queue: [...s.queue, made.customer], rngState: made.rngState, nextId: made.nextId };
      }
      s = { ...s, nextCustomerAt: s.nextCustomerAt + ARRIVAL_MS };
    }
    s = assignWork(c, s, t);
  }
  return { ...s, lastTickAt: until };
}

export function clearIdleReport(s: GameState): GameState {
  return { ...s, idleReport: { jobs: 0, coins: 0, xp: 0 } };
}
