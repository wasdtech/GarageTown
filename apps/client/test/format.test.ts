import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
const { paintFor } = await import('../src/scenes/GarageScene');
const { fmt } = await import('../src/ui/format');

describe('scene helpers', () => {
  it('formats remaining time', () => {
    expect(fmt(17)).toBe('17s');
    expect(fmt(125)).toBe('2m 05s');
    expect(fmt(3600)).toBe('1h 00m');
  });

  it('gives a stable paint per id', () => {
    expect(paintFor('c1')).toBe(paintFor('c1'));
    expect(typeof paintFor('c2')).toBe('number');
  });
});
