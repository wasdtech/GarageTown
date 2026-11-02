import type { GameState } from '@gt/sim';

/** A car journey the scene should animate, derived from two consecutive states (visual only). */
export type Transition =
  | { kind: 'arrive'; customerId: string; carKey: string; slot: number; vip?: boolean }
  | { kind: 'toBay'; customerId: string; carKey: string; fromSlot: number; bayId: string; vip?: boolean }
  | { kind: 'leave'; customerId: string; carKey: string; bayId: string; vip?: boolean }
  | { kind: 'giveUp'; customerId: string; carKey: string; slot: number; vip?: boolean };

export function diffTransitions(prev: GameState | null, next: GameState): Transition[] {
  if (!prev) return [];
  const out: Transition[] = [];
  const prevQueue = new Map(prev.queue.map((q, i) => [q.id, { q, slot: i }]));
  const nextQueue = new Set(next.queue.map((q) => q.id));
  const nextBayOf = new Map(next.bays.filter((b) => b.job).map((b) => [b.job!.customerId, b.id]));
  const prevInBay = new Set(prev.bays.filter((b) => b.job).map((b) => b.job!.customerId));

  // leaving bays first so the street is clear for newcomers
  for (const b of prev.bays) {
    if (b.job && !nextBayOf.has(b.job.customerId)) {
      out.push({
        kind: 'leave',
        customerId: b.job.customerId,
        carKey: b.job.carKey,
        bayId: b.id,
        ...(b.job.vip ? { vip: true } : {}),
      });
    }
  }
  for (const [id, { q, slot }] of prevQueue) {
    if (nextQueue.has(id)) continue;
    const bayId = nextBayOf.get(id);
    const vip = q.vip ? { vip: true } : {};
    if (bayId) out.push({ kind: 'toBay', customerId: id, carKey: q.carKey, fromSlot: slot, bayId, ...vip });
    else out.push({ kind: 'giveUp', customerId: id, carKey: q.carKey, slot, ...vip });
  }
  next.queue.forEach((q, slot) => {
    if (!prevQueue.has(q.id) && !prevInBay.has(q.id)) {
      out.push({ kind: 'arrive', customerId: q.id, carKey: q.carKey, slot, ...(q.vip ? { vip: true } : {}) });
    }
  });
  return out;
}
