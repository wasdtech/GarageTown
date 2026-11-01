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

describe('collectLabel', () => {
  it('shows the real timely bonus in coins', async () => {
    const { collectLabel } = await import('../src/ui/format');
    expect(collectLabel(15, true)).toBe('Coletar  +1 🪙');
    expect(collectLabel(300, true)).toBe('Coletar  +30 🪙');
  });

  it('hides the bonus when it rounds to zero or the window passed', async () => {
    const { collectLabel } = await import('../src/ui/format');
    expect(collectLabel(5, true)).toBe('Coletar');
    expect(collectLabel(300, false)).toBe('Coletar');
  });
});
