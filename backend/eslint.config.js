/**
 * ESLint 9 flat config — porting della legacy .eslintrc.js.
 * Target: Node.js 20, CommonJS, Jest. Reinstalla le regole
 * originali senza introdurre nuove restrizioni.
 */
'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|err$)',
          destructuredArrayIgnorePattern: '^_'
        }
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      // R-LINT-TODO-001 — F-LOW-CODE-004 + doctrine H-19 closure.
      // Triage outcome: `grep -rn "TODO\\|FIXME" backend/src` returned 0
      // matches at enable time. Going forward, any TODO/FIXME/XXX/HACK
      // surfaces as a build error — the lint forces the author to either
      // resolve the comment or attach an issue link inline.
      'no-warning-comments': ['error', {
        terms: ['todo', 'fixme', 'xxx', 'hack'],
        location: 'anywhere'
      }],
      'eqeqeq': ['error', 'smart'],
      'no-return-await': 'error',
      'no-throw-literal': 'error',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },
  {
    // Node richiede globals diversi per i test Jest
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    }
  },
  {
    ignores: ['node_modules/', 'coverage/', 'dist/']
  }
];
