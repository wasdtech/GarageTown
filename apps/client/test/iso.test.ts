import { describe, expect, it } from 'vitest';
import { depthOf, isoToScreen, screenToIso } from '../src/iso/iso';

const o = { x: 400, y: 100 };

describe('iso', () => {
  it('maps the origin tile to the origin', () => {
    expect(isoToScreen(0, 0, o)).toEqual(o);
  });

  it('steps half a tile per axis', () => {
    expect(isoToScreen(1, 0, o)).toEqual({ x: 432, y: 116 });
    expect(isoToScreen(0, 1, o)).toEqual({ x: 368, y: 116 });
  });

  it('inverts back to the integer tile', () => {
    const p = isoToScreen(3, 5, o);
    expect(screenToIso(p.x, p.y + 1, o)).toEqual({ x: 3, y: 5 });
  });

  it('orders depth by x + y', () => {
    expect(depthOf(2, 3)).toBeLessThan(depthOf(3, 3));
  });
});
