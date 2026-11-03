import type { BayType } from '@gt/shared';
import { type GameState, jobProgress } from '@gt/sim';

export type WorkerAction = 'scrub' | 'wrench' | 'spray';

export interface Worker {
  bayId: string;
  customerId: string;
  action: WorkerAction;
  helperKey: string | null;
  /** Colour multiplied onto the overalls layer. */
  tint: number;
}

export const DEFAULT_OVERALLS = 0x3a86ff;

/** Overalls colour per helper key, so the player can tell who is working where. */
export const HELPER_OVERALLS: Record<string, number> = {
  ze: 0xff8c42,
  bia: 0xff5ca8,
  tiao: 0x06d6a0,
  neusa: 0x9b5de5,
};

const ACTION: Record<BayType, WorkerAction> = {
  wash: 'scrub',
  mechanic: 'wrench',
  paint: 'spray',
  performance: 'wrench',
};

/** The mechanic shown beside each car in service (visual only). */
export function workersFor(s: GameState, now: number): Worker[] {
  const out: Worker[] = [];
  for (const b of s.bays) {
    if (!b.job || jobProgress(b.job, now).done) continue;
    const helper = s.helpers.find((h) => h.bayId === b.id);
    out.push({
      bayId: b.id,
      customerId: b.job.customerId,
      action: ACTION[b.type],
      helperKey: helper?.key ?? null,
      tint: (helper && HELPER_OVERALLS[helper.key]) ?? DEFAULT_OVERALLS,
    });
  }
  return out;
}
