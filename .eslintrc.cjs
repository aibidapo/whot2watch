module.exports = {
  root: true,
  env: { es2023: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'sonarjs', 'unicorn'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:sonarjs/recommended',
    'plugin:unicorn/recommended',
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    'unicorn/prevent-abbreviations': 'off',
    'import/no-unresolved': 'off',
    // Ban TODO/FIXME markers in code; use issues/ROADMAP instead
    'no-warning-comments': ['error', { terms: ['todo', 'fixme'], location: 'anywhere' }],
    // Enforce consistent naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'variableLike', format: ['camelCase', 'UPPER_CASE'] },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'function', format: ['camelCase'] }
    ],
    'no-restricted-imports': ['error', {
      paths: [
        { name: '@supabase/supabase-js', message: 'Use the API gateway; do not import supabase client in apps/services.' }
      ]
    }],
  },
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/', 'whot2watch-docs-full/'],
};
