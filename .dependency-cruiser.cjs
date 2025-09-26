module.exports = {
  forbidden: [
    { name: 'no-cycles', from: {}, to: { circular: true } },
    { name: 'no-deep-imports', from: { path: '^(apps|services|packages)/' }, to: { path: '.*/(internal|src)/' } },
    { name: 'apps-no-apps', from: { path: '^apps/[^/]+' }, to: { path: '^apps/[^/]+' } },
    { name: 'apps-only-packages', from: { path: '^apps/' }, to: { pathNot: '^(packages|services)/' } }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' }
  }
};
