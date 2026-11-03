import { describe, expect, it } from 'vitest';
import { COIN, splitCoins } from '../src/ui/dom';

describe('splitCoins', () => {
  it('splits a text on the coin emoji so the drawn coin can go in its place', () => {
    expect(splitCoins('150 🪙')).toEqual(['150 ', COIN]);
    expect(splitCoins('Treinar · 1200 🪙 agora')).toEqual(['Treinar · 1200 ', COIN, ' agora']);
    expect(splitCoins('+5 🪙 e +3 🪙')).toEqual(['+5 ', COIN, ' e +3 ', COIN]);
  });

  it('leaves texts without coins alone', () => {
    expect(splitCoins('Fechar')).toEqual(['Fechar']);
    expect(splitCoins('')).toEqual([]);
  });
});
