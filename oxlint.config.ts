import { typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"

export default defineConfig({
  extends: [typescript],
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
  rules: {
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
