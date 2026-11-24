import { fileURLToPath } from "node:url"
import { typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"

const noVitestFixtures = {
  property: "extend",
  message: "Do not use Vitest custom fixtures because oxlint vitest rules don't support them (see ADR-035).",
}

const allowedComments = {
  prefixes: ["INTENT:", "CONSTRAINT:", "oxlint-disable", "@ts-expect-error"],
  message: "Use a // line comment starting with INTENT:, CONSTRAINT:, oxlint-disable, or @ts-expect-error.",
}

const restrictedSyntax = [
  ...typescript.rules["eslint-js/no-restricted-syntax"],
  { selector: "ImportExpression", message: "Use a static import declaration." },
] satisfies NonNullable<OxlintConfig["rules"]>[string]

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
      files: ["**/*.{test,spec}.{ts,tsx}", "**/*.test-d.ts"],
      excludeFiles: ["**/playwright/**"],
      rules: {
        "eslint-js/no-restricted-syntax": [
          ...restrictedSyntax,
          {
            selector: "TryStatement[finalizer]",
            message:
              "Use afterEach for routine or inexpensive cleanup. Reserve onTestFinished or explicit Resource Management with `using` or `await using` and resources that implement `Symbol.dispose` or `Symbol.asyncDispose` for resources local to one test or expensive cleanup that only a few tests need.",
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
    "eslint-js/no-restricted-syntax": restrictedSyntax,
  },
} satisfies OxlintConfig)
