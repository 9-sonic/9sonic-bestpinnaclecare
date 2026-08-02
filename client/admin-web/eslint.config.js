import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// The office app had `eslint .` as a script but no config file at all, so the
// lint step could only ever fail. This mirrors client/pwa/eslint.config.js —
// two frontends linted by two different rule sets is how the same mistake gets
// caught in one and shipped from the other.
export default [
  {
    ignores: ['dist/**', 'public/**'],
  },

  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        // Injected by Vite's `define` (see vite.config.js).
        __APP_VERSION__: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Every console call in this app already carries an eslint-disable
      // marker, so the convention was "console is deliberate, not casual" —
      // the rule enabling it was just never there. Warn, not error: a stray
      // console.log should be visible in review, not a red CI run.
      'no-console': 'warn',
      'react/prop-types': 'off',
    },
  },

  {
    files: ['*.config.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
