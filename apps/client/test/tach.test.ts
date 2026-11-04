import { describe, expect, it } from 'vitest';
import { TACH_DIAL, tachAngle, tachArc } from '../src/ui/tach';

describe('tachAngle', () => {
  it('maps 1000..8000 rpm onto -120..+120 degrees', () => {
    expect(tachAngle(1000)).toBe(-120);
    expect(tachAngle(8000)).toBe(120);
    expect(tachAngle(4500)).toBe(0);
  });

  it('clamps outside the range', () => {
    expect(tachAngle(0)).toBe(-120);
    expect(tachAngle(9500)).toBe(120);
  });
});

describe('the dial', () => {
  it('fits its whole arc, stroke included, inside the viewBox', () => {
    const { w, h, cx, cy, r, stroke } = TACH_DIAL;
    const nums = (d: string) => d.match(/-?[\d.]+/g)!.map(Number);
    // M x1 y1 A r r 0 large 1 x2 y2: the two ends sit lowest on the dial
    const n = nums(tachArc(cx, cy, r, 1000, 8000));
    const ends: [number, number][] = [
      [n[0]!, n[1]!],
      [n[7]!, n[8]!],
    ];
    for (const [x, y] of ends) {
      expect(x - stroke / 2).toBeGreaterThanOrEqual(0);
      expect(x + stroke / 2).toBeLessThanOrEqual(w);
      expect(y + stroke / 2).toBeLessThanOrEqual(h);
    }
    expect(cy - r - stroke / 2).toBeGreaterThanOrEqual(0);
  });
});
