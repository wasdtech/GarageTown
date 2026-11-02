import type { BayType } from '@gt/shared';
import { type GameState, jobProgress } from '@gt/sim';

export type Ambient =
  { id: string; kind: 'idle' | 'impatient' } | { id: string; kind: 'service'; bay: BayType };

export const IMPATIENT_BELOW = 0.3;

/** Which life animation each visible car should have right now (visual only). */
export function ambientFor(s: GameState, now: number): Ambient[] {
  const out: Ambient[] = [];
  for (const q of s.queue) {
    const left = (q.patienceUntil - now) / (q.patienceUntil - q.arrivedAt);
    out.push({ id: q.id, kind: left < IMPATIENT_BELOW ? 'impatient' : 'idle' });
  }
  for (const b of s.bays) {
    if (b.job && !jobProgress(b.job, now).done)
      out.push({ id: b.job.customerId, kind: 'service', bay: b.type });
  }
  return out;
}
