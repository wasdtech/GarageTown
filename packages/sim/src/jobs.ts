import type { Content, JobKey } from '@gt/shared';
import { tick } from './customers';
import { levelForXp } from './levels';
import { boostCoins, boostDuration, boostXp } from './perks';
import { err, ok, type Result } from './result';
import { type ActiveJob, type GameState, touch, VIP_COIN_MULTIPLIER } from './state';

export interface Reward {
  coins: number;
  xp: number;
  tip: number;
  timelyBonus: number;
  reputation: number;
  levelBefore: number;
  levelAfter: number;
}

export type StartError =
  'bay_busy' | 'wrong_bay_type' | 'job_locked' | 'no_customer' | 'unknown_job' | 'unknown_bay';
export type CollectError = 'empty_bay' | 'not_done' | 'unknown_bay';

export const TIMELY_WINDOW_MS = 300_000;
export const TIMELY_BONUS = 0.1;
export const TIP_RATE = 0.2;

export function startJob(
  c: Content,
  state: GameState,
  a: { customerId: string; bayId: string; jobKey: JobKey },
  now: number,
): Result<GameState, StartError> {
  const s = tick(c, state, now);
  const bay = s.bays.find((b) => b.id === a.bayId);
  if (!bay) return err('unknown_bay');
  const def = c.jobs.find((j) => j.key === a.jobKey);
  if (!def) return err('unknown_job');
  const customer = s.queue.find((q) => q.id === a.customerId);
  if (!customer) return err('no_customer');
  if (bay.job) return err('bay_busy');
  if (def.bay !== bay.type) return err('wrong_bay_type');
  if (def.unlockLevel > levelForXp(c, s.xp)) return err('job_locked');

  const job: ActiveJob = {
    jobKey: def.key,
    customerId: customer.id,
    carKey: customer.carKey,
    need: customer.need,
    startedAt: now,
    durationS: boostDuration(c, s, def.durationS),
    ...(customer.vip ? { vip: true } : {}),
  };
  return ok(
    touch(
      {
        ...s,
        queue: s.queue.filter((q) => q.id !== customer.id),
        bays: s.bays.map((b) => (b.id === bay.id ? { ...b, job } : b)),
      },
      now,
    ),
  );
}

export function jobProgress(
  job: ActiveJob,
  now: number,
): { done: boolean; remainingMs: number; fraction: number } {
  const total = job.durationS * 1000;
  const elapsed = Math.min(total, Math.max(0, now - job.startedAt));
  return { done: elapsed >= total, remainingMs: total - elapsed, fraction: elapsed / total };
}

/** Computes the payout for a finished job. `minigameBonus` is a rate (0 when not used). */
export function computeReward(
  c: Content,
  s: GameState,
  job: ActiveJob,
  now: number,
  opts: { minigameBonus: number },
): Reward {
  const def = c.jobs.find((j) => j.key === job.jobKey)!;
  const base = def.coins * (job.vip ? VIP_COIN_MULTIPLIER : 1);
  const matched = job.need === job.jobKey;
  const tip = matched ? Math.floor(base * TIP_RATE) : 0;
  const doneAt = job.startedAt + job.durationS * 1000;
  const timelyBonus =
    opts.minigameBonus === 0 && now <= doneAt + TIMELY_WINDOW_MS ? Math.floor(base * TIMELY_BONUS) : 0;
  // lucro boosts the job's coins (and the minigame bonus on them), not the tip or the timely bonus
  const boosted = boostCoins(c, s, base);
  const minigame = Math.floor(boosted * opts.minigameBonus);
  const xp = boostXp(c, s, def.xp);
  return {
    coins: boosted + tip + timelyBonus + minigame,
    xp,
    tip,
    timelyBonus,
    reputation: matched ? 1 : 0,
    levelBefore: levelForXp(c, s.xp),
    levelAfter: levelForXp(c, s.xp + xp),
  };
}

/** Payout for a job a helper started: coins x share (VIP double first), full XP, no tip/timely/reputation. */
export function helperReward(c: Content, s: GameState, job: ActiveJob, helper: { level: number }): Reward {
  const def = c.jobs.find((j) => j.key === job.jobKey)!;
  const base = def.coins * (job.vip ? VIP_COIN_MULTIPLIER : 1);
  const share = c.helperLevels[helper.level - 1]?.share ?? c.helperLevels[0]!.share;
  const xp = boostXp(c, s, def.xp);
  return {
    coins: boostCoins(c, s, Math.floor(base * share)),
    xp,
    tip: 0,
    timelyBonus: 0,
    reputation: 0,
    levelBefore: levelForXp(c, s.xp),
    levelAfter: levelForXp(c, s.xp + xp),
  };
}

/** Applies a reward and frees the bay. */
export function applyReward(s: GameState, bayId: string, reward: Reward): GameState {
  return {
    ...s,
    coins: s.coins + reward.coins,
    xp: s.xp + reward.xp,
    reputation: s.reputation + reward.reputation,
    prestige: { ...s.prestige, runCoins: s.prestige.runCoins + reward.coins },
    bays: s.bays.map((b) => (b.id === bayId ? { ...b, job: null } : b)),
  };
}

export function collectJob(
  c: Content,
  state: GameState,
  bayId: string,
  now: number,
): Result<{ state: GameState; reward: Reward }, CollectError> {
  const s = tick(c, state, now);
  const bay = s.bays.find((b) => b.id === bayId);
  if (!bay) return err('unknown_bay');
  if (!bay.job) return err('empty_bay');
  if (!jobProgress(bay.job, now).done) return err('not_done');
  const helper = bay.job.byHelper
    ? (s.helpers.find((h) => h.key === bay.job!.byHelper) ?? { level: 1 })
    : null;
  const reward = helper
    ? helperReward(c, s, bay.job, helper)
    : computeReward(c, s, bay.job, now, { minigameBonus: 0 });
  return ok({ state: touch(applyReward(s, bayId, reward), now), reward });
}
