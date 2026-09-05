export default [
  {
    files: ['**/*.js'],
    ignores: ['dist/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
         setInterval: 'readonly',
         clearInterval: 'readonly',
      },
    },
    rules: {
       'no-unused-vars': 'off',
      'no-undef': 'error',
    },
  },
];