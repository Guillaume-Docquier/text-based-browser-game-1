import path from "node:path"
import { typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"

export default defineConfig({
  extends: [typescript],
  jsPlugins: [path.resolve(import.meta.dirname, "scripts/oxlint-plugin.ts")],
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
  rules: {
    "project/no-vitest-fixtures": "error",
    "eslint-js/no-restricted-syntax": [
      ...typescript.rules["eslint-js/no-restricted-syntax"],
      { selector: "ImportExpression", message: "Use a static import declaration." },
    ],
  },
  overrides: [
    {
      ...vitest,
      files: ["**/*.test.{ts,tsx}"],
    },
    {
      files: ["scripts/**/*"],
      rules: {
        "no-console": "off",
      },
    },
  ],
} satisfies OxlintConfig)
