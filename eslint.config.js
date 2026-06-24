/**
 * ESLint flat config for BakeFlow ERP.
 * Enforces code quality rules across all JS modules.
 * Run: npx eslint js/**\/*.js
 */

import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    ignores: ['js/__tests__/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
      globals: {
        window:        'readonly',
        document:      'readonly',
        localStorage:  'readonly',
        URL:           'readonly',
        Blob:          'readonly',
        FileReader:    'readonly',
        AbortController: 'readonly',
        CustomEvent:   'readonly',
        Event:         'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout:    'readonly',
        clearTimeout:  'readonly',
        console:       'readonly'
      }
    },
    rules: {
      // ── Errors ────────────────────────────────────────────────────────────
      'no-unused-vars':        ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef':              'error',
      'no-duplicate-imports':  'error',
      'no-var':                'error',

      // ── BakeFlow-specific guards ──────────────────────────────────────────
      // Prevent direct localStorage calls outside storage.js
      'no-restricted-globals': [
        'error',
        {
          name:    'alert',
          message: 'Use modal.alert() instead of window.alert().'
        },
        {
          name:    'confirm',
          message: 'Use modal.confirm() instead of window.confirm().'
        },
        {
          name:    'prompt',
          message: 'Use modal.form() instead of window.prompt().'
        }
      ],
      'no-restricted-syntax': [
        'error',
        {
          // Ban raw console.log — use logger utility instead
          selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
          message:  "Use logger.info() instead of console.log(). (logger is in utils.js)"
        },
        {
          // Ban direct localStorage outside storage.js
          selector: "MemberExpression[object.name='localStorage']",
          message:  "Direct localStorage access is forbidden. Use the storage module (js/storage.js)."
        }
      ],

      // ── Style ─────────────────────────────────────────────────────────────
      'prefer-const':          'error',
      'eqeqeq':                ['error', 'always'],
      'curly':                 ['error', 'all'],
      'no-else-return':        'warn',
      'no-implicit-coercion':  'warn',

      // ── Safety ───────────────────────────────────────────────────────────
      'no-eval':               'error',
      'no-implied-eval':       'error',
      'no-new-func':           'error',
      'no-script-url':         'error',
      'no-prototype-builtins': 'warn'
    }
  },
  {
    // Relax localStorage rule inside storage.js — it IS the storage module
    files: ['js/storage.js'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  {
    // Relax console rules inside utils.js logger + test files
    files: ['js/utils.js', 'js/__tests__/**/*.js'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-undef': 'off'
    }
  }
];
