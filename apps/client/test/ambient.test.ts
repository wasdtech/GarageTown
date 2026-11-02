import { loadContent } from '@gt/shared';
import { createInitialState, type GameState } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { ambientFor } from '../src/scenes/ambient';

const c = loadContent();
const T0 = 1_700_000_000_000;
const base = (): GameState => ({ ...createInitialState(c, T0, 1), nextCustomerAt: Number.MAX_SAFE_INTEGER });
const cust = (id: string, arrivedAt: number) => ({
  id,
  carKey: 'pitoco',
  need: 'wash',
  arrivedAt,
  patienceUntil: arrivedAt + 120_000,
});

describe('ambientFor', () => {
  it('a fresh customer idles; one under 30% patience is impatient', () => {
    const s = { ...base(), queue: [cust('a', T0), cust('b', T0 - 90_000)] };
    expect(ambientFor(s, T0)).toEqual([
      { id: 'a', kind: 'idle' },
      { id: 'b', kind: 'impatient' },
    ]);
  });

  it('a car in service shows its bay type; a finished one shows nothing', () => {
    const job = {
      jobKey: 'touchup',
      customerId: 'p',
      carKey: 'pitoco',
      need: 'touchup',
      startedAt: T0,
      durationS: 600,
    };
    const s = {
      ...base(),
      bays: [...base().bays, { id: 'bay3', type: 'paint' as const, tile: { x: 2, y: 0 }, job }],
    };
    expect(ambientFor(s, T0 + 10_000)).toEqual([{ id: 'p', kind: 'service', bay: 'paint' }]);
    expect(ambientFor(s, T0 + 600_000)).toEqual([]);
  });
});
