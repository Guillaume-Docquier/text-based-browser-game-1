import { defineConfig, type OxlintConfig } from "oxlint"
import baseConfig from "../../oxlint.config.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  env: {
    node: true,
  },
  plugins: ["vitest"],
  overrides: [
    {
      files: ["**/*.ts"],
      excludeFiles: ["**/*.error.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["**/TransactionRollbackError", "**/TransactionRollbackError.*"],
                message: "TransactionRollbackError can only be used in *.error.ts files. Use a specific rollback error instead.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/api/**/*.router*.ts"],
      rules: {
        // Routers and their tests intentionally return awaited void outputs to streamline the router handlers.
        "typescript/no-confusing-void-expression": "off",
      },
    },
    {
      files: ["src/**/*.test-d.ts"],
      rules: {
        // Rejected type expressions are asserted with @ts-expect-error, without an expectation call.
        "vitest/expect-expect": "off",
      },
    },
    {
      files: ["src/**/*.ts"],
      excludeFiles: ["src/**/*.test.ts"],
      rules: {
        "no-restricted-globals": ["error", { name: "Date", message: "Use an injected clock instead." }],
      },
    },
    {
      files: ["src/**/*.integration.test.ts"],
      rules: {
        // Fixture support
        "vitest/require-hook": ["error", { allowedFunctionCalls: ["integrationTest", "integrationTest.for"] }],
        "vitest/no-standalone-expect": ["error", { additionalTestBlockFunctions: ["integrationTest", "integrationTest.for"] }],
      },
    },
  ],
} satisfies OxlintConfig)
