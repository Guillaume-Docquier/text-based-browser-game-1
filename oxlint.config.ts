import { fileURLToPath } from "node:url"
import { typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"
import { WorkspaceBoundaries } from "./linting/boundaries.ts"

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
  {
    selector: "ObjectExpression > SpreadElement > LogicalExpression[operator='&&']",
    message: "Use an if statement to set optional properties on a typed object.",
  },
  { selector: "ImportExpression", message: "Use a static import declaration." },
  {
    selector: "ExportNamedDeclaration[source]",
    message: "Import directly from the module that defines the binding.",
  },
] satisfies NonNullable<OxlintConfig["rules"]>[string]

export default defineConfig({
  extends: [typescript],
  jsPlugins: [fileURLToPath(new URL("./linting/plugins/cosmic-empires-plugin.ts", import.meta.url)), "eslint-plugin-boundaries"],
  settings: WorkspaceBoundaries.settings,
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
  rules: {
    ...WorkspaceBoundaries.rules,
    "cosmic-empires/allowed-comments": ["error", allowedComments],
    "cosmic-empires/no-renamed-imports": "error",
    "eslint-js/no-restricted-syntax": restrictedSyntax,
    "import/no-default-export": "error",
    "import/no-namespace": "error",
    "unicorn/prefer-export-from": "error",
  },
  overrides: [
    {
      files: ["**/*.config.*", ".railway/railway.ts", "linting/plugins/**", "**/*.stories.{ts,tsx}", "**/.storybook/**"],
      rules: { "import/no-default-export": "off" },
    },
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
              "Use afterEach for routine or inexpensive cleanup. Use onTestFinished for resources local to one test or expensive cleanup that only a few tests need. Use Explicit Resource Management (`using` and `await using`) in helpers that always need to be cleaned up.",
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
} satisfies OxlintConfig)
