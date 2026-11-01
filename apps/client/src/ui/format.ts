import { TIMELY_BONUS } from '@gt/sim';

export function fmt(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${String(secs % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Label for a finished job; shows the timely bonus only when it is worth at least 1 coin. */
export function collectLabel(coins: number, timely: boolean): string {
  const bonus = timely ? Math.floor(coins * TIMELY_BONUS) : 0;
  return bonus > 0 ? `Coletar  +${bonus} 🪙` : 'Coletar';
}
