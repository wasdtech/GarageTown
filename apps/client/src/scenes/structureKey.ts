import { type GameState, jobProgress, TIMELY_WINDOW_MS } from '@gt/sim';

/**
 * Identifies what the scene must rebuild for. Anything not captured here (progress bars, timers,
 * patience bars) is updated in place, so a ticking clock doesn't recreate every sprite each second.
 */
export function structureKey(s: GameState, now: number, ui: { selectedCustomerId: string | null }): string {
  const bays = s.bays.map((b) => {
    if (!b.job) return `${b.id}:-`;
    const done = jobProgress(b.job, now).done;
    const timely = now <= b.job.startedAt + b.job.durationS * 1000 + TIMELY_WINDOW_MS;
    return `${b.id}:${b.job.customerId}:${done ? (timely ? 'T' : 'D') : 'R'}`;
  });
  const builds = s.builds.map((b) => `${b.slot}:${b.type}`).join(',');
  const active = s.collection.cars.find((x) => x.id === s.collection.activeCarId);
  const showcase = active ? `${active.model}:${JSON.stringify(active.look)}` : '';
  return [
    bays.join(','),
    builds,
    showcase,
    s.queue.map((q) => q.id).join(','),
    ui.selectedCustomerId ?? '',
  ].join('|');
}
