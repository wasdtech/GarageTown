import { defineConfig } from 'vitest/config';

const project = (name: string, root: string) => ({
  test: { name, root, include: ['test/**/*.test.ts'], environment: 'node' as const },
});

export default defineConfig({
  test: {
    projects: [
      project('shared', './packages/shared'),
      project('sim', './packages/sim'),
      project('client', './apps/client'),
    ],
  },
});
