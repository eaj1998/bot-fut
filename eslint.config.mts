import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['./**/*.{ts}'],
    languageOptions: { globals: globals.node },
    ignores: ['./src/public', '**/*.{js}'],
    extends: [
      tseslint.configs.recommended,
      prettier,
    ],
    rules: {
      'prettier/prettier': [
        'error',
        {
          tabWidth: 2,
          useTabs: false,
          semi: true,
          singleQuote: true,
          trailingComma: 'es5',
          printWidth: 100,
        },
      ],
    },
  },
]);
