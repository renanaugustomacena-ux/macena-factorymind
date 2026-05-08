/**
 * ESLint 9 flat config per il frontend React + TypeScript.
 *
 * Copre:
 *   - parser typescript-eslint con progetto tipato
 *   - regole base React (pensate per Vite, no CRA)
 *   - no-unused-vars tollerante con prefisso underscore
 */
'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.es2023
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|err$)',
          destructuredArrayIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // R-FRONTEND-NO-CONSOLE-001 — F-LOW-CODE-003 closure. Production
      // frontend should not console-log; only console.error is allowed,
      // since ErrorBoundary's `__FM_ERROR_SINK` will subsume that path
      // when the deferred logger ships (UPLIFT roadmap; tracked under
      // observability stream).
      'no-console': ['error', { allow: ['error'] }],
      // R-LINT-TODO-001 — F-LOW-CODE-004 + doctrine H-19 closure. Comments
      // tagged TODO / FIXME / XXX / HACK become actionable lint errors;
      // every existing comment was triaged to zero in the same batch
      // (`grep -rn "TODO\\|FIXME" src` returned empty pre-commit).
      'no-warning-comments': ['error', {
        terms: ['todo', 'fixme', 'xxx', 'hack'],
        location: 'anywhere'
      }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '.vite/']
  }
];
