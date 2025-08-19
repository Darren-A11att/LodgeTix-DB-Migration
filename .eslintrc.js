module.exports = {
  root: true,
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.next/',
    '**/*.d.ts',
    'Database-Export/',
    'Payments-Export/'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: false,
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'import', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-undef': 'off',
    'import/order': [
      'warn',
      { groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'], 'newlines-between': 'always' }
    ],
    'unused-imports/no-unused-imports': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parserOptions: { project: null },
    },
    {
      files: ['migration-viewer/**/*.{ts,tsx}'],
      extends: ['next/core-web-vitals'],
    },
    {
      files: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'],
      extends: ['next/core-web-vitals'],
    },
  ],
};
