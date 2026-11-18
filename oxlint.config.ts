import { typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"

const noVitestFixtures = {
  property: "extend",
  message: "Do not use Vitest custom fixtures because oxlint vitest rules don't support them (see ADR-035).",
}

export default defineConfig({
  extends: [typescript],
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
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
  rules: {
    "no-restricted-properties": ["error", { object: "test", ...noVitestFixtures }, { object: "it", ...noVitestFixtures }],
    "eslint-js/no-restricted-syntax": [
      ...typescript.rules["eslint-js/no-restricted-syntax"],
      { selector: "ImportExpression", message: "Use a static import declaration." },
    ],
  },
} satisfies OxlintConfig)
