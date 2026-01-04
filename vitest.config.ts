import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Include tests from all packages
    include: ['packages/*/tests/**/*.test.ts'],
    // Global test configuration
    globals: false,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.d.ts',
        'packages/*/tests/**',
        '**/node_modules/**',
      ],
    },
  },
});
