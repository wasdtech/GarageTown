import { loadContent } from '@gt/shared';
import { createInitialState, type GameState } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OVERALLS, HELPER_OVERALLS, workersFor } from '../src/scenes/worker';

const c = loadContent();
const T0 = 1_700_000_000_000;
const job = (customerId: string) => ({
  jobKey: 'touchup',
  customerId,
  carKey: 'pitoco',
  need: 'touchup',
  startedAt: T0,
  durationS: 600,
});
const withBays = (): GameState => {
  const s = createInitialState(c, T0, 1);
  return {
    ...s,
    bays: [
      { id: 'w', type: 'wash', tile: { x: 0, y: 0 }, job: job('a') },
      { id: 'm', type: 'mechanic', tile: { x: 1, y: 0 }, job: job('b') },
      { id: 'p', type: 'paint', tile: { x: 2, y: 0 }, job: job('c') },
      { id: 'f', type: 'performance', tile: { x: 3, y: 0 }, job: job('d') },
      { id: 'e', type: 'wash', tile: { x: 4, y: 0 }, job: null },
    ],
  };
};

describe('workersFor', () => {
  it('puts a worker on every bay in service, with the action of its bay type', () => {
    const w = workersFor(withBays(), T0 + 1000);
    expect(w.map((x) => [x.bayId, x.customerId, x.action])).toEqual([
      ['w', 'a', 'scrub'],
      ['m', 'b', 'wrench'],
      ['p', 'c', 'spray'],
      ['f', 'd', 'wrench'],
    ]);
    expect(w.every((x) => x.tint === DEFAULT_OVERALLS && x.helperKey === null)).toBe(true);
  });

  it('a bay with a helper gets that helper with their overalls colour', () => {
    const s = { ...withBays(), helpers: [{ key: 'bia', level: 1, bayId: 'p' }] };
    const p = workersFor(s, T0 + 1000).find((x) => x.bayId === 'p');
    expect(p).toMatchObject({ helperKey: 'bia', tint: HELPER_OVERALLS.bia });
    expect(HELPER_OVERALLS.bia).not.toBe(DEFAULT_OVERALLS);
  });

  it('no worker once the job is done', () => {
    expect(workersFor(withBays(), T0 + 600_000)).toEqual([]);
  });

  it('every helper in the content has its own colour', () => {
    const tints = c.helpers.map((h) => HELPER_OVERALLS[h.key]);
    expect(tints.every((t) => typeof t === 'number')).toBe(true);
    expect(new Set([...tints, DEFAULT_OVERALLS]).size).toBe(tints.length + 1);
  });
});
