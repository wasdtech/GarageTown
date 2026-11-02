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

describe('customization content', () => {
  it('gives every car base stats, a price and an unlock level', () => {
    const cars = loadContent().cars;
    expect(cars.map((x) => [x.key, x.price, x.unlockLevel])).toEqual([
      ['pitoco', 0, 1],
      ['brutus_v8', 3000, 5],
      ['corisco_rs', 8000, 8],
    ]);
    for (const car of cars) expect(car.power).toBeGreaterThan(0);
  });

  it('has 4 parts with 3 tiers each, prices rising', () => {
    const parts = loadContent().parts;
    expect(parts.map((p) => p.key)).toEqual(['engine', 'turbo', 'tires', 'suspension']);
    for (const p of parts) {
      expect(p.tiers).toHaveLength(3);
      expect(p.tiers[0]!.cost).toBeLessThan(p.tiers[1]!.cost);
      expect(p.tiers[1]!.cost).toBeLessThan(p.tiers[2]!.cost);
    }
  });

  it('has 12 paints (red free) and the look options', () => {
    const looks = loadContent().looks;
    expect(looks.paints).toHaveLength(12);
    expect(looks.paints[0]).toMatchObject({ key: 'red', cost: 0 });
    expect(looks.finishes.map((f) => [f.key, f.cost])).toEqual([
      ['matte', 0],
      ['metallic', 1000],
      ['pearl', 4000],
    ]);
    expect(looks.neon).toMatchObject({ cost: 2500, unlockLevel: 6 });
    expect(looks.stickers.map((s) => [s.key, s.cost])).toEqual([
      ['number', 600],
      ['bolt', 600],
      ['star', 600],
    ]);
  });
});

describe('helpers content', () => {
  it('has the four helpers with unlock levels and prices', () => {
    expect(loadContent().helpers.map((h) => [h.key, h.unlockLevel, h.price])).toEqual([
      ['ze', 2, 300],
      ['bia', 4, 1500],
      ['tiao', 7, 4000],
      ['neusa', 10, 10000],
    ]);
  });

  it('has 5 training levels and 3 clock tiers', () => {
    const c = loadContent();
    expect(c.helperLevels.map((l) => l.speed)).toEqual([1, 0.93, 0.86, 0.79, 0.72]);
    expect(c.helperLevels.map((l) => l.share)).toEqual([0.8, 0.84, 0.88, 0.92, 0.95]);
    expect(c.helperLevels.map((l) => l.trainCostMult)).toEqual([0, 2, 4, 8, 16]);
    expect(c.clockTiers).toEqual([
      { hours: 4, cost: 0 },
      { hours: 6, cost: 3000 },
      { hours: 8, cost: 12000 },
    ]);
  });
});
