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

describe('structureKey and constructions', () => {
  it('changes when a construction starts and when it finishes', async () => {
    const { startBuild } = await import('@gt/sim');
    const s0 = {
      ...createInitialState(c, T0, 1),
      xp: 60,
      coins: 500,
      nextCustomerAt: Number.MAX_SAFE_INTEGER,
    };
    const r = startBuild(c, s0, { slot: 3, type: 'paint' }, T0);
    if (!r.ok) throw new Error(r.error);
    const before = structureKey(s0, T0, ui);
    const building = structureKey(r.value, T0 + 1_000, ui);
    const done = structureKey(tick(c, r.value, T0 + 120_000), T0 + 120_000, ui);
    expect(new Set([before, building, done]).size).toBe(3);
    expect(structureKey(r.value, T0 + 2_000, ui)).toBe(building);
  });
});

describe('structureKey and the showcase car', () => {
  it('changes when the showcase car look changes', async () => {
    const { applyLook } = await import('@gt/sim');
    const s0 = { ...createInitialState(c, T0, 1), coins: 500, nextCustomerAt: Number.MAX_SAFE_INTEGER };
    const r = applyLook(c, s0, { carId: 'car-pitoco', paint: 'blue' }, T0);
    if (!r.ok) throw new Error(r.error);
    expect(structureKey(r.value, T0, ui)).not.toBe(structureKey(s0, T0, ui));
  });
});

describe('structureKey and helpers', () => {
  it('changes when a helper is assigned to a bay', async () => {
    const { hireHelper, assignHelper } = await import('@gt/sim');
    const s0 = {
      ...createInitialState(c, T0, 1),
      xp: 20,
      coins: 300,
      nextCustomerAt: Number.MAX_SAFE_INTEGER,
    };
    const hired = hireHelper(c, s0, 'ze', T0);
    if (!hired.ok) throw new Error(hired.error);
    const on = assignHelper(c, hired.value, 'ze', 'bay1', T0);
    if (!on.ok) throw new Error(on.error);
    expect(structureKey(on.value, T0, ui)).not.toBe(structureKey(hired.value, T0, ui));
  });
});
