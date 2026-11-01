import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Express mengenali error handler dari 4 parameternya; `next` wajib ada meski tak dipakai.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$', ignoreRestSiblings: true }],
    },
  },
];
