import { loadContent } from '@gt/shared';
import { describe, expect, it } from 'vitest';
import { xpFraction } from '../src/ui/hud';

const c = loadContent();

describe('xpFraction', () => {
  it('measures progress within the current level', () => {
    expect(xpFraction(c, 0)).toBe(0);
    expect(xpFraction(c, 10)).toBe(0.5);
    expect(xpFraction(c, 35)).toBe(0.5);
  });

  it('is full at the max level', () => {
    expect(xpFraction(c, 9999)).toBe(1);
  });
});
