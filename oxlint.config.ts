import { fileURLToPath } from "node:url"
import { typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"

const noVitestFixtures = {
  property: "extend",
  message: "Do not use Vitest custom fixtures because oxlint vitest rules don't support them (see ADR-035).",
}

const allowedComments = {
  prefixes: ["INTENT:", "CONSTRAINT:", "oxlint-disable", "@ts-expect-error"],
  message: "Code comments are restricted. Only INTENT:, CONSTRAINT:, oxlint-disable, or @ts-expect-error are allowed.",
}

export default defineConfig({
  extends: [typescript],
  jsPlugins: [fileURLToPath(new URL("./linting/plugins/cosmic-empires-plugin.ts", import.meta.url))],
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
  overrides: [
    {
      files: ["**/*"],
      excludeFiles: ["**/playwright/**/*"],
      rules: {
        "no-restricted-properties": ["error", { object: "test", ...noVitestFixtures }, { object: "it", ...noVitestFixtures }],
      },
    },
    {
      ...vitest,
      files: ["**/*.test.{ts,tsx}"],
      rules: {
        ...vitest.rules,
        "cosmic-empires/allowed-comments": [
          "error",
          {
            prefixes: [...allowedComments.prefixes, "Arrange", "Act", "Assert"],
            message: `${allowedComments.message} Test comments can also start with Arrange, Act, or Assert.`,
          },
        ],
      },
    },
    {
      files: ["scripts/**/*"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  rules: {
    "cosmic-empires/allowed-comments": ["error", allowedComments],
    "eslint-js/no-restricted-syntax": [
      ...typescript.rules["eslint-js/no-restricted-syntax"],
      { selector: "ImportExpression", message: "Use a static import declaration." },
    ],
  },
} satisfies OxlintConfig)
