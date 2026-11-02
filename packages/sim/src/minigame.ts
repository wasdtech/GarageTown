import type { Content } from '@gt/shared';
import { tick } from './customers';
import { applyReward, computeReward, type Reward } from './jobs';
import { err, ok, type Result } from './result';
import { type ActiveJob, type GameState, touch } from './state';

export type MinigameError =
  'empty_bay' | 'not_eligible' | 'gesture_too_short' | 'rate_limited' | 'unknown_bay';

export const MINIGAME_BONUS = 0.25;
export const MINIGAME_MIN_GESTURE_MS = 5_000;
export const MINIGAME_MAX_PER_HOUR = 20;
export const MINIGAME_MAX_DURATION_S = 300;
const HOUR_MS = 3_600_000;

export function isMinigameEligible(c: Content, job: ActiveJob): boolean {
  const def = c.jobs.find((j) => j.key === job.jobKey);
  return !!def && def.durationS <= MINIGAME_MAX_DURATION_S && def.bay === 'wash';
}

/** How many minigame completions are still allowed in the rolling hour. */
export function minigameUsesLeft(s: GameState, now: number): number {
  return Math.max(0, MINIGAME_MAX_PER_HOUR - s.minigameUses.filter((t) => t > now - HOUR_MS).length);
}

export function completeWithMinigame(
  c: Content,
  state: GameState,
  bayId: string,
  gestureMs: number,
  now: number,
): Result<{ state: GameState; reward: Reward }, MinigameError> {
  const s = tick(c, state, now);
  const bay = s.bays.find((b) => b.id === bayId);
  if (!bay) return err('unknown_bay');
  if (!bay.job) return err('empty_bay');
  if (!isMinigameEligible(c, bay.job)) return err('not_eligible');
  if (gestureMs < MINIGAME_MIN_GESTURE_MS) return err('gesture_too_short');
  if (minigameUsesLeft(s, now) === 0) return err('rate_limited');
  const recent = s.minigameUses.filter((t) => t > now - HOUR_MS);

  const reward = computeReward(c, s, bay.job, now, { minigameBonus: MINIGAME_BONUS });
  return ok({
    state: touch({ ...applyReward(s, bayId, reward), minigameUses: [...recent, now] }, now),
    reward,
  });
}
