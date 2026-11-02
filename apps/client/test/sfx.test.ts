import { describe, expect, it } from 'vitest';
import { createSfx } from '../src/ui/sfx';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: () => null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('sfx', () => {
  it('never throws where Web Audio does not exist', () => {
    const sfx = createSfx(memoryStorage(), undefined);
    expect(() => {
      sfx.coin();
      sfx.click();
      sfx.levelUp();
      sfx.build();
    }).not.toThrow();
  });

  it('remembers the mute choice', () => {
    const st = memoryStorage();
    const a = createSfx(st, undefined);
    expect(a.muted).toBe(false);
    a.setMuted(true);
    expect(createSfx(st, undefined).muted).toBe(true);
  });

  it('plays notes on the audio context unless muted', () => {
    const started: number[] = [];
    const node = () => ({
      connect: () => node(),
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      type: '',
      start: (t: number) => started.push(t),
      stop() {},
    });
    class FakeCtx {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator = node;
      createGain = node;
      resume() {}
    }
    const sfx = createSfx(memoryStorage(), FakeCtx as unknown as typeof AudioContext);
    sfx.coin();
    expect(started.length).toBeGreaterThan(0);
    const n = started.length;
    sfx.setMuted(true);
    sfx.levelUp();
    expect(started.length).toBe(n);
  });
});
