import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import-x";
import noComments from "eslint-plugin-no-comments";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const apiLayer = (files, forbidden, message) => ({
  files,
  ignores: ["**/*.test.ts"],
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group: forbidden, message }] }],
  },
});

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/src/generated/**",
      "**/next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { "import-x": importPlugin },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "import-x/order": [
        "error",
        {
          groups: [
            ["builtin", "external", "object"],
            ["internal", "unknown", "parent", "sibling", "index"],
            "type",
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
        },
      ],
      "import-x/no-duplicates": "error",
    },
  },
  apiLayer(
    ["apps/api/src/domain/**/*.ts"],
    ["**/application/**", "**/infra/**", "@/application/*", "@/infra/*", "@nestjs/*", "@prisma/*"],
    "domain/ must not import application/, infra/ or frameworks. Dependencies point inward only.",
  ),
  apiLayer(
    ["apps/api/src/application/**/*.ts"],
    ["**/infra/**", "**/generated/**", "@/infra/*", "@/generated/*", "@nestjs/*", "@prisma/*"],
    "application/ must not import infra/ or frameworks. Depend on a port in application/ports/ instead.",
  ),
  {
    files: ["apps/*/src/**/*.{ts,tsx}", "apps/*/test/**/*.ts", "packages/*/src/**/*.ts"],
    ignores: ["**/*.config.*"],
    plugins: { "no-comments": noComments },
    rules: {
      "no-comments/disallowComments": "error",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      "@next/next/no-html-link-for-pages": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Render product data as text; dangerouslySetInnerHTML is not allowed.",
        },
      ],
    },
  },
  prettier,
);
