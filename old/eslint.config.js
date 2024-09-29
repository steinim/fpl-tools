import globals from 'globals';
import js from '@eslint/js';

export default [
  {
    files: ['**/*.{js,mjs,cjs}'], // Lint JS files
    languageOptions: {
      ecmaVersion: 2021, // Equivalent to es2021
      sourceType: 'module',
      globals: {
        ...globals.node, // Enable Node.js globals like 'process'
        ...globals.browser, // If you also work in a browser environment
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
    },
  },
];

