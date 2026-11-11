import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tanstackQuery from "@tanstack/eslint-plugin-query";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/coverage/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  {
    // Scripts do k6 (bench/*.js): rodam dentro da VM do k6, não no Node,
    // com globais próprios (__ENV, __VU, __ITER) via import maps internos.
    files: ["bench/**/*.js"],
    languageOptions: {
      globals: {
        __ENV: "readonly",
        __VU: "readonly",
        __ITER: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.mts", "**/*.cts", "**/*.tsx", "**/*.jsx"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    // Só apps/web tem React: hooks, a11y e TanStack Query entram aqui.
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "@tanstack/query": tanstackQuery,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...tanstackQuery.configs["flat/recommended"][0].rules,
    },
  },
  eslintConfigPrettier,
);
