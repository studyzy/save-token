import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/docs/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'bin',
        '*.config.ts',
        '*.config.mjs',
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/types/**',
        'src/i18n/**',
        'src/adapters/claude-code-adapter.ts',
        'src/adapters/codex-adapter.ts',
      ],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
