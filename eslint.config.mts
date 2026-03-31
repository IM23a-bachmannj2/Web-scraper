import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
export default defineConfig([
    {
        ignores: ["coverage/**", "dist/**", "node_modules/**"],
    },
    {
        files: ["public/**/*.js"],
        languageOptions: {
            globals: globals.browser,
            sourceType: "script",
        },
    },
    {
        files: ["src/**/*.{ts,mts,cts}", "tests/**/*.{ts,mts,cts}"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
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
    files: ["*.config.js", "jest.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
