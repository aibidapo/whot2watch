import { defineConfig } from 'vitest/config';

export default defineConfig(() => {
  const shouldUseContainers =
    process.env.TEST_WITH_CONTAINERS === 'true' || !process.env.DATABASE_URL;
  return {
    test: {
      passWithNoTests: true,
      setupFiles: shouldUseContainers ? ['scripts/testcontainers.setup.ts'] : [],
      coverage: {
        provider: 'v8',
        reportsDirectory: 'coverage',
        reporter: ['text-summary', 'lcov'],
        all: true,
        include: ['server/**/*.ts', 'services/**/*.ts'],
        exclude: ['**/*.d.ts'],
        thresholds: {
          lines: 80,
          branches: 80,
          functions: 80,
          statements: 80,
        },
      },
    },
  };
});
