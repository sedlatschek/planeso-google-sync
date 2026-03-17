import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: [
    'dist/**',
    'node_modules/**',
  ] },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: {
      js,
      '@stylistic': stylistic,
    },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.strict,
  stylistic.configs.recommended,
  { rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@stylistic/semi': [
      'error',
      'always',
    ],
    '@stylistic/object-curly-newline': [
      'error',
      { minProperties: 2 },
    ],
    '@stylistic/object-property-newline': 'error',
    '@stylistic/array-bracket-newline': [
      'error',
      { minItems: 2 },
    ],
    '@stylistic/array-element-newline': [
      'error',
      { minItems: 2 },
    ],
  } },
]);
