import { describe, expect, it } from 'vitest';
import { startJob } from '../src/jobs';
import { completeWithMinigame } from '../src/minigame';
import type { GameState } from '../src/state';
import { content as c, T0, withCustomer } from './helpers';

function started(need: string, jobKey: string, bayId: string, extra: Partial<GameState> = {}) {
  const r = startJob(c, withCustomer(need, c, extra), { customerId: 'cx', bayId, jobKey }, T0);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('completeWithMinigame', () => {
  it('completes a wash instantly with the 25% bonus', () => {
    const r = completeWithMinigame(c, started('wash', 'wash', 'bay1'), 'bay1', 5_000, T0 + 6_000);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.reward).toMatchObject({ coins: 7, tip: 1, timelyBonus: 0 });
    expect(r.value.state.bays[0]!.job).toBeNull();
    expect(r.value.state.minigameUses).toEqual([T0 + 6_000]);
  });

  it('rejects a gesture shorter than 5 seconds', () => {
    expect(completeWithMinigame(c, started('wash', 'wash', 'bay1'), 'bay1', 4_999, T0 + 6_000)).toEqual({
      ok: false,
      error: 'gesture_too_short',
    });
  });

  it('rejects ineligible jobs', () => {
    const lvl4 = { xp: 130 };
    expect(
      completeWithMinigame(c, started('engine', 'engine', 'bay2', lvl4), 'bay2', 6_000, T0 + 7_000),
    ).toEqual({ ok: false, error: 'not_eligible' });
    expect(completeWithMinigame(c, started('oil', 'oil', 'bay2'), 'bay2', 6_000, T0 + 7_000)).toEqual({
      ok: false,
      error: 'not_eligible',
    });
  });

  it('rejects an empty bay', () => {
    expect(completeWithMinigame(c, withCustomer('wash'), 'bay1', 6_000, T0 + 7_000)).toEqual({
      ok: false,
      error: 'empty_bay',
    });
  });

  it('limits to 20 uses per rolling hour', () => {
    const first = T0 + 6_000;
    const uses = Array.from({ length: 20 }, (_, i) => first + i * 1_000);
    const now = first + 30_000;
    const s = started('wash', 'wash', 'bay1', { minigameUses: uses });
    expect(completeWithMinigame(c, s, 'bay1', 6_000, now)).toEqual({ ok: false, error: 'rate_limited' });

    const later = first + 3_600_001;
    const r = completeWithMinigame(c, s, 'bay1', 6_000, later);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.state.minigameUses).toHaveLength(20);
    expect(r.value.state.minigameUses.every((t) => t > later - 3_600_000)).toBe(true);
  });
});

describe('minigameUsesLeft', () => {
  it('counts the uses left in the rolling hour', async () => {
    const { minigameUsesLeft } = await import('../src/minigame');
    const s = withCustomer('wash');
    expect(minigameUsesLeft(s, T0)).toBe(20);
    const uses = Array.from({ length: 20 }, (_, i) => T0 + i);
    expect(minigameUsesLeft({ ...s, minigameUses: uses }, T0 + 100)).toBe(0);
    expect(minigameUsesLeft({ ...s, minigameUses: uses }, T0 + 3_600_005)).toBe(6);
  });
});
