import { loadContent } from '@gt/shared';
import { createInitialState } from '@gt/sim';
import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, loadGame, SAVE_KEY, saveGame } from '../src/state/storage';

const c = loadContent();
const T0 = 1_700_000_000_000;

function memoryStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('storage', () => {
  it('saves and loads a game', () => {
    const st = memoryStorage();
    const s = { ...createInitialState(c, T0, 1), coins: 42 };
    saveGame(s, st);
    expect(loadGame(c, T0, st).coins).toBe(42);
  });

  it('backs up a corrupt save before starting fresh', () => {
    const st = memoryStorage({ [SAVE_KEY]: '{oops' });
    expect(loadGame(c, T0, st).coins).toBe(0);
    expect(st.getItem(BACKUP_KEY)).toBe('{oops');
  });

  it('survives a storage that throws', () => {
    const broken = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    } as Storage;
    expect(loadGame(c, T0, broken).coins).toBe(0);
    expect(() => saveGame(createInitialState(c, T0, 1), broken)).not.toThrow();
  });
});
