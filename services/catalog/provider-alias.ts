/* eslint-disable unicorn/prefer-module, @typescript-eslint/no-var-requires */
// Type-safe TS shim around CJS module providerAlias.js
const {
  canonicalizeProvider,
}: { canonicalizeProvider: (input: string) => string | undefined } = require('./providerAlias');

export { canonicalizeProvider };
