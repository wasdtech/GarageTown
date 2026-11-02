import type { GameState } from '@gt/sim';

/** Away for at least this long (with helper work) before the welcome-back sheet shows. */
export const AWAY_MS = 60_000;

/**
 * Decides, once per second, what the player's presence means:
 * - 'welcome': they just came back from a real absence and helpers did work → show the sheet;
 * - 'present': they are here → keep the shift going and drop in-session work from the report;
 * - 'none': the page is hidden or the welcome sheet is still open.
 */
export function presenceAction(
  s: GameState,
  now: number,
  o: { visible: boolean; sheetOpen: boolean },
): 'welcome' | 'present' | 'none' {
  if (!o.visible || o.sheetOpen) return 'none';
  if (s.idleReport.jobs > 0 && now - s.lastActiveAt >= AWAY_MS) return 'welcome';
  return 'present';
}
