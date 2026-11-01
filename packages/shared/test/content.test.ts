import { describe, expect, it } from 'vitest';
import { loadContent, parseContent } from '../src/content';

const raw = () =>
  structuredClone(loadContent()) as unknown as Record<string, unknown> & {
    jobs: Record<string, unknown>[];
    levels: Record<string, unknown>[];
  };

describe('content', () => {
  it('loads the M0 content', () => {
    const c = loadContent();
    expect(c.jobs).toHaveLength(11);
    expect(c.levels).toHaveLength(15);
    expect(c.cars).toHaveLength(3);
    expect(c.brand.name).toBe('Garage Town');
  });

  it('gives every job an icon sprite', () => {
    expect(loadContent().jobs.every((j) => j.icon.length > 0)).toBe(true);
  });

  it('rejects a job without an icon', () => {
    const r = raw();
    delete r.jobs[0]!.icon;
    expect(() => parseContent(r)).toThrow();
  });

  it('rejects a job with zero duration', () => {
    const r = raw();
    r.jobs[0]!.durationS = 0;
    expect(() => parseContent(r)).toThrow();
  });

  it('has paint and performance jobs from the growth block', () => {
    const bays = new Set(loadContent().jobs.map((j) => j.bay));
    expect([...bays].sort()).toEqual(['mechanic', 'paint', 'performance', 'wash']);
  });

  it('defines two prebuilt bays and two buildable slots', () => {
    const g = loadContent().garage;
    expect(g.bays.filter((b) => b.prebuilt)).toHaveLength(2);
    expect(g.bays.filter((b) => !b.prebuilt).map((b) => [b.level, b.cost, b.buildS])).toEqual([
      [3, 150, 120],
      [6, 400, 600],
    ]);
  });

  it('rejects an unknown bay type', () => {
    const r = raw();
    r.jobs[0]!.bay = 'spaceship';
    expect(() => parseContent(r)).toThrow();
  });

  it('rejects levels out of ascending xp order', () => {
    const r = raw();
    r.levels[2]!.xp = 10;
    expect(() => parseContent(r)).toThrow();
  });

  it('rejects unlockLevel above the max level', () => {
    const r = raw();
    r.jobs[0]!.unlockLevel = 16;
    expect(() => parseContent(r)).toThrow();
  });

  it('rejects duplicate job keys', () => {
    const r = raw();
    r.jobs[1]!.key = r.jobs[0]!.key;
    expect(() => parseContent(r)).toThrow();
  });
});
