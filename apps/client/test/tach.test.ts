import { describe, expect, it } from 'vitest';
import { tachAngle } from '../src/ui/tach';

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
