export default [
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['dist/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        browser: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
         document: 'readonly',
         window: 'readonly',
      },
    },
    rules: {
       'no-unused-vars': 'off',
      'no-undef': 'error',
    },
  },
];