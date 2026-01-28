/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  mutate: [
    'server/agents/workers/recommendations.worker.ts',
    'server/plans/gate.ts',
    'server/plans/service.ts',
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 0,
  },
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  timeoutMS: 60000,
};
