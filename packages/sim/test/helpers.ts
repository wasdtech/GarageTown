import { type Content, loadContent } from '@gt/shared';
import { createInitialState, type GameState } from '../src/state';

export const T0 = 1_700_000_000_000;
export const content = loadContent();

/** Initial state with one long-patience customer and no further arrivals. */
export function withCustomer(need: string, c: Content = content, extra: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState(c, T0, 1),
    queue: [{ id: 'cx', carKey: 'vespa_gt', need, arrivedAt: T0, patienceUntil: T0 + 1e12 }],
    nextCustomerAt: Number.MAX_SAFE_INTEGER,
    ...extra,
  };
}
