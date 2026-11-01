import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/index';

describe('sim', () => {
  it('exposes its version', () => {
    expect(SIM_VERSION).toBe(1);
  });
});
