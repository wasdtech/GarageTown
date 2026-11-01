import { loadContent } from '@gt/shared';
import { createInitialState, type GameState } from '@gt/sim';
import { describe, expect, it, vi } from 'vitest';
import { Store } from '../src/state/store';

const c = loadContent();
const T0 = 1_700_000_000_000;

function setup() {
  let now = T0;
  const base = createInitialState(c, T0, 1);
  const initial: GameState = {
    ...base,
    queue: [{ id: 'cx', carKey: 'pitoco', need: 'wash', arrivedAt: T0, patienceUntil: T0 + 1e12 }],
    nextCustomerAt: Number.MAX_SAFE_INTEGER,
  };
  const persist = vi.fn();
  const store = new Store(c, initial, () => now, persist);
  return { store, persist, advance: (ms: number) => (now += ms) };
}

describe('Store', () => {
  it('does not persist a failed collect', () => {
    const { store, persist } = setup();
    expect(store.start({ customerId: 'cx', bayId: 'bay1', jobKey: 'wash' }).ok).toBe(true);
    persist.mockClear();
    expect(store.collect('bay1')).toEqual({ ok: false, error: 'not_done' });
    expect(persist).not.toHaveBeenCalled();
  });

  it('pays once on a double collect', () => {
    const { store, advance } = setup();
    store.start({ customerId: 'cx', bayId: 'bay1', jobKey: 'wash' });
    advance(30_000);
    expect(store.collect('bay1').ok).toBe(true);
    expect(store.collect('bay1')).toEqual({ ok: false, error: 'empty_bay' });
    expect(store.state.coins).toBe(6);
  });

  it('notifies subscribers once per action', () => {
    const { store } = setup();
    const fn = vi.fn();
    store.subscribe(fn);
    store.start({ customerId: 'cx', bayId: 'bay1', jobKey: 'wash' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('persists on tick every 5 seconds', () => {
    const { store, persist, advance } = setup();
    advance(1_000);
    store.tick();
    expect(persist).not.toHaveBeenCalled();
    advance(4_000);
    store.tick();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe('Store.build', () => {
  it('starts a construction and persists it', () => {
    const persist = vi.fn();
    const s = {
      ...createInitialState(c, T0, 1),
      xp: 60,
      coins: 200,
      nextCustomerAt: Number.MAX_SAFE_INTEGER,
    };
    const store = new Store(c, s, () => T0, persist);
    expect(store.build(3, 'paint')).toEqual({ ok: true, value: undefined });
    expect(store.state.builds).toHaveLength(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(store.build(3, 'paint')).toEqual({ ok: false, error: 'slot_taken' });
  });
});

describe('Store garage actions', () => {
  it('buys a part, applies a look and persists each change', () => {
    const persist = vi.fn();
    const s = {
      ...createInitialState(c, T0, 1),
      xp: 20,
      coins: 1000,
      nextCustomerAt: Number.MAX_SAFE_INTEGER,
    };
    const store = new Store(c, s, () => T0, persist);
    expect(store.buyPart('car-pitoco', 'engine')).toEqual({ ok: true, value: undefined });
    expect(store.applyLook('car-pitoco', { paint: 'blue' })).toEqual({ ok: true, value: undefined });
    expect(store.state.coins).toBe(350);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(store.buyCar('brutus_v8')).toEqual({ ok: false, error: 'locked' });
    expect(store.setActiveCar('car-pitoco')).toEqual({ ok: true, value: undefined });
  });
});
