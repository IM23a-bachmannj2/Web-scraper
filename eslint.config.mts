import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
export default defineConfig([
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**"],
  },
  {
    files: ["public/**/*.js", "src/**/*.{ts,mts,cts}"],
    languageOptions: {
      globals: globals.browser,
      sourceType: "module",
    },
  },
  {
    files: ["tests/**/*.{ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  tseslint.configs.recommended,
  {
    files: ["tests/**/*.{ts,mts,cts}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["*.config.js", "jest.config.js", "scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
