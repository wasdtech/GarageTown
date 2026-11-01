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
    expect(c.jobs).toHaveLength(5);
    expect(c.levels).toHaveLength(5);
    expect(c.cars).toHaveLength(3);
    expect(c.brand.name).toBe('Garage Town');
  });

  it('gives every job an icon sprite', () => {
    expect(loadContent().jobs.map((j) => j.icon)).toEqual(['wash', 'oil', 'polish', 'tires', 'engine']);
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

  it('rejects an unknown bay type', () => {
    const r = raw();
    r.jobs[0]!.bay = 'paint';
    expect(() => parseContent(r)).toThrow();
  });

  it('rejects levels out of ascending xp order', () => {
    const r = raw();
    r.levels[2]!.xp = 10;
    expect(() => parseContent(r)).toThrow();
  });

  it('rejects unlockLevel above the max level', () => {
    const r = raw();
    r.jobs[0]!.unlockLevel = 6;
    expect(() => parseContent(r)).toThrow();
  });

  it('rejects duplicate job keys', () => {
    const r = raw();
    r.jobs[1]!.key = r.jobs[0]!.key;
    expect(() => parseContent(r)).toThrow();
  });
});
