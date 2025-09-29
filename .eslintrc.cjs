module.exports = {
  root: true,
  env: { es2023: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'sonarjs', 'unicorn', 'react-hooks'],
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
      { selector: 'function', format: ['camelCase'] },
    ],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@supabase/supabase-js',
            message: 'Use the API gateway; do not import supabase client in apps/services.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx,d.ts}'],
      parserOptions: { ecmaFeatures: { jsx: true } },
      rules: {
        // Next.js/React conventions
        '@typescript-eslint/naming-convention': 'off',
        'unicorn/filename-case': 'off',
        'unicorn/no-null': 'off',
        'unicorn/explicit-length-check': 'off',
        'unicorn/prefer-dom-node-dataset': 'off',
        'unicorn/prefer-spread': 'off',
        'unicorn/catch-error-name': 'off',
        'no-empty': 'off',
        // Allow generated Next file and its triple-slash refs
        '@typescript-eslint/triple-slash-reference': 'off',
        // React hooks rule comes from react-hooks plugin (already loaded)
        'react-hooks/exhaustive-deps': 'off',
        // Be lenient on unused vars in pages during active dev
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['server/**/*.{test,spec}.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'prefer-const': 'off',
        'no-empty': 'off',
        'sonarjs/no-duplicate-string': 'off',
        'unicorn/no-null': 'off',
        'unicorn/prefer-ternary': 'off',
        'unicorn/prefer-at': 'off',
        'unicorn/numeric-separators-style': 'off',
        'unicorn/filename-case': 'off',
        'unicorn/explicit-length-check': 'off',
        'unicorn/prefer-spread': 'off',
        'unicorn/prefer-native-coercion-functions': 'off',
        'unicorn/no-array-callback-reference': 'off',
      },
    },
    {
      files: ['server/**/*.ts'],
      excludedFiles: ['server/**/*.{test,spec}.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/naming-convention': 'off',
        'no-empty': 'off',
        'unicorn/prefer-node-protocol': 'off',
        'unicorn/numeric-separators-style': 'off',
        'unicorn/explicit-length-check': 'off',
        'unicorn/prefer-spread': 'off',
        'unicorn/no-array-callback-reference': 'off',
        'unicorn/consistent-function-scoping': 'off',
        'unicorn/prefer-native-coercion-functions': 'off',
        'unicorn/catch-error-name': 'off',
        'unicorn/filename-case': 'off',
      },
    },
    {
      files: ['services/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'unicorn/prefer-string-replace-all': 'off',
        'unicorn/switch-case-braces': 'off',
      },
    },
    {
      files: ['whot2watch-docs/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/', 'whot2watch-docs-full/'],
};
