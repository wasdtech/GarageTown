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

describe('sfx: more sounds and music', () => {
  it('all new sounds are safe without Web Audio', () => {
    const sfx = createSfx(memoryStorage(), undefined);
    expect(() => {
      for (const k of ['horn', 'engine', 'error', 'menu', 'register', 'hired', 'scrub', 'welcome'] as const)
        sfx[k]();
      sfx.setMusic(true);
      sfx.startMusic();
      sfx.stopMusic();
    }).not.toThrow();
  });

  it('music and effects preferences are independent and remembered', () => {
    const st = memoryStorage();
    const a = createSfx(st, undefined);
    expect(a.musicOn).toBe(true);
    a.setMuted(true);
    expect(a.musicOn).toBe(true);
    a.setMusic(false);
    const b = createSfx(st, undefined);
    expect(b.muted).toBe(true);
    expect(b.musicOn).toBe(false);
  });
});

describe('music on touch devices', () => {
  it('resumes a suspended audio context for the music even when effects are muted', () => {
    let resumed = 0;
    const node = () => ({
      connect: () => node(),
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      type: '',
      start() {},
      stop() {},
    });
    class SuspendedCtx {
      currentTime = 0;
      state = 'suspended';
      destination = {};
      createOscillator = node;
      createGain = node;
      resume() {
        resumed++;
      }
    }
    const sfx = createSfx(memoryStorage(), SuspendedCtx as unknown as typeof AudioContext);
    sfx.setMuted(true);
    sfx.startMusic();
    expect(resumed).toBeGreaterThan(0);
    // a later gesture must resume the context again even though the loop is already running
    const before = resumed;
    sfx.startMusic();
    expect(resumed).toBeGreaterThan(before);
    sfx.stopMusic();
  });
});

describe('sfx in a hidden tab', () => {
  it('suspends the audio (the race engine included) while hidden and resumes after', () => {
    const calls: string[] = [];
    const node = () => ({
      connect: () => node(),
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
      type: '',
      start() {},
      stop() {},
    });
    class FakeCtx {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator = node;
      createGain = node;
      resume() {
        calls.push('resume');
        this.state = 'running';
      }
      suspend() {
        calls.push('suspend');
        this.state = 'suspended';
      }
    }
    const sfx = createSfx(memoryStorage(), FakeCtx as unknown as typeof AudioContext);
    sfx.revStart();
    sfx.setHidden(true);
    expect(calls).toEqual(['suspend']);
    // a sound asked for while hidden does not wake the audio up
    sfx.coin();
    expect(calls).toEqual(['suspend']);
    sfx.setHidden(false);
    expect(calls).toEqual(['suspend', 'resume']);
  });
});
