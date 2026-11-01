import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadContent } from '@gt/shared';
import { describe, expect, it } from 'vitest';

describe('brand name', () => {
  it('is not hard-coded in index.html (only content/brand.json)', () => {
    const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
    expect(html).not.toContain(loadContent().brand.name);
  });
});
