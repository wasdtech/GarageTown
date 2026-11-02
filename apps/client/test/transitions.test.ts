import { loadContent } from '@gt/shared';
import { collectJob, createInitialState, type GameState, startJob, tick } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { diffTransitions } from '../src/scenes/transitions';

const c = loadContent();
const T0 = 1_700_000_000_000;

function withQueue(): GameState {
  return tick(c, createInitialState(c, T0, 1), T0 + 40_000); // two customers
}

describe('diffTransitions', () => {
  it('animates nothing on the first render', () => {
    expect(diffTransitions(null, withQueue())).toEqual([]);
  });

  it('detects customers arriving in the queue', () => {
    const a = tick(c, createInitialState(c, T0, 1), T0 + 20_000);
    const b = tick(c, a, T0 + 40_000);
    expect(diffTransitions(a, b)).toEqual([
      { kind: 'arrive', customerId: b.queue[1]!.id, carKey: b.queue[1]!.carKey, slot: 1 },
    ]);
  });

  it('detects a customer driving from the queue to a bay', () => {
    const a = withQueue();
    const q = a.queue[0]!;
    const r = startJob(c, a, { customerId: q.id, bayId: 'bay1', jobKey: 'wash' }, T0 + 40_000);
    if (!r.ok) throw new Error(r.error);
    expect(diffTransitions(a, r.value)).toEqual([
      { kind: 'toBay', customerId: q.id, carKey: q.carKey, fromSlot: 0, bayId: 'bay1' },
    ]);
  });

  it('detects a car leaving after its job is collected', () => {
    const a = withQueue();
    const q = a.queue[0]!;
    const r = startJob(
      c,
      { ...a, nextCustomerAt: Number.MAX_SAFE_INTEGER },
      { customerId: q.id, bayId: 'bay1', jobKey: 'wash' },
      T0 + 40_000,
    );
    if (!r.ok) throw new Error(r.error);
    const done = collectJob(c, r.value, 'bay1', T0 + 80_000);
    if (!done.ok) throw new Error(done.error);
    expect(diffTransitions(r.value, done.value.state)).toContainEqual({
      kind: 'leave',
      customerId: q.id,
      carKey: q.carKey,
      bayId: 'bay1',
    });
  });

  it('detects a customer giving up', () => {
    const a = withQueue();
    const gone = { ...a, queue: a.queue.slice(1) };
    expect(diffTransitions(a, gone)).toEqual([
      { kind: 'giveUp', customerId: a.queue[0]!.id, carKey: a.queue[0]!.carKey, slot: 0 },
    ]);
  });
});

describe('VIP journeys', () => {
  it('carry the vip flag so the travelling car is gold', () => {
    const a = withQueue();
    const b = { ...a, queue: [{ ...a.queue[0]!, vip: true }, ...a.queue.slice(1)] };
    const gone = { ...b, queue: b.queue.slice(1) };
    expect(diffTransitions(b, gone)[0]).toMatchObject({ kind: 'giveUp', vip: true });
  });
});
