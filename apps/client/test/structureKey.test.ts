import { loadContent } from '@gt/shared';
import { createInitialState, startJob, tick } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { structureKey } from '../src/scenes/structureKey';

const c = loadContent();
const T0 = 1_700_000_000_000;
const ui = { selectedCustomerId: null };

function withWash() {
  const s0 = tick(c, createInitialState(c, T0, 1), T0 + 20_000);
  const q = s0.queue[0]!;
  const r = startJob(
    c,
    { ...s0, nextCustomerAt: Number.MAX_SAFE_INTEGER },
    { customerId: q.id, bayId: 'bay1', jobKey: 'wash' },
    T0 + 20_000,
  );
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('structureKey', () => {
  it('is stable while a job is merely progressing', () => {
    const s = withWash();
    expect(structureKey(s, T0 + 25_000, ui)).toBe(structureKey(s, T0 + 40_000, ui));
  });

  it('changes when a job finishes and when its timely window ends', () => {
    const s = withWash();
    const running = structureKey(s, T0 + 40_000, ui);
    const done = structureKey(s, T0 + 50_000, ui);
    const late = structureKey(s, T0 + 50_000 + 300_001, ui);
    expect(new Set([running, done, late]).size).toBe(3);
  });

  it('changes with the queue and the selection', () => {
    const s = tick(c, createInitialState(c, T0, 1), T0 + 20_000);
    const a = structureKey(s, T0 + 20_000, ui);
    expect(structureKey({ ...s, queue: [] }, T0 + 20_000, ui)).not.toBe(a);
    expect(structureKey(s, T0 + 20_000, { selectedCustomerId: s.queue[0]!.id })).not.toBe(a);
  });
});
