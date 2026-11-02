import { loadContent } from '@gt/shared';
import { createInitialState, type GameState } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { presenceAction } from '../src/ui/presence';

const c = loadContent();
const T0 = 1_700_000_000_000;
const st = (extra: Partial<GameState>): GameState => ({ ...createInitialState(c, T0, 1), ...extra });
const report = { jobs: 3, coins: 30, xp: 9 };

describe('presenceAction', () => {
  it('a visible player keeps the shift going', () => {
    expect(presenceAction(st({}), T0 + 1_000, { visible: true, sheetOpen: false })).toBe('present');
  });

  it('coming back after a minute or more with helper work shows the welcome sheet', () => {
    expect(presenceAction(st({ idleReport: report }), T0 + 60_000, { visible: true, sheetOpen: false })).toBe(
      'welcome',
    );
  });

  it('a short absence just counts as present (report cleared, no sheet)', () => {
    expect(presenceAction(st({ idleReport: report }), T0 + 59_000, { visible: true, sheetOpen: false })).toBe(
      'present',
    );
  });

  it('does nothing while hidden or while the welcome sheet is open', () => {
    expect(
      presenceAction(st({ idleReport: report }), T0 + 3_600_000, { visible: false, sheetOpen: false }),
    ).toBe('none');
    expect(
      presenceAction(st({ idleReport: report }), T0 + 3_600_000, { visible: true, sheetOpen: true }),
    ).toBe('none');
  });
});
