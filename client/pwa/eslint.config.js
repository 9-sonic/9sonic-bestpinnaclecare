import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Flat config, replacing .eslintrc.json. ESLint 9 made this the default format
// and ESLint 10 removed eslintrc support outright, so the old file would not
// have been read at all — `npm run lint` would have failed looking for this
// one. Same rules as before; only the shape changed.
export default [
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'UI-Previews/**',
      'public/**',
    ],
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
        // The service worker registration code touches worker globals.
        ...globals.serviceworker,
        // Injected by Vite's `define` (see vite.config.js), so it is real at
        // runtime but invisible to the linter.
        __APP_VERSION__: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Every console call in this app already carries an eslint-disable
      // marker, so the convention was "console is deliberate, not casual" —
      // the rule enabling it was just never there. Warn, not error: a stray
      // console.log should be visible in review, not a red CI run.
      'no-console': 'warn',
      // Not using the prop-types package; component contracts are documented in
      // comments and enforced at review time.
      'react/prop-types': 'off',
    },
  },

  // Build and test tooling runs in Node, not the browser.
  {
    files: ['*.config.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
