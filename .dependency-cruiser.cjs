/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are not allowed.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Modules without any incoming or outgoing dependencies.',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '\\.test\\.ts$', '\\.spec\\.ts$'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', 'dist', 'coverage', '*_files'],
    },
    exclude: {
      path: ['apps/web', 'node_modules', 'dist', 'coverage', '*_files'],
    },
    tsConfig: {
      fileName: './tsconfig.json',
    },
  },
};
