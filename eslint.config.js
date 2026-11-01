import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-types/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      '.superpowers/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'sim is pure: pass `now` as a parameter.' },
        { object: 'Math', property: 'random', message: 'sim is pure: use the seeded rng in state.' },
      ],
    },
  },
);
