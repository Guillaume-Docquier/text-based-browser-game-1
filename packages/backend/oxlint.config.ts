import { defineConfig, type OxlintConfig, type OxlintOverride } from "oxlint"
import baseConfig from "../../oxlint.config.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  env: {
    node: true,
  },
  plugins: ["vitest"],
  jsPlugins: ["./oxlint-vitest-fixtures.ts"],
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
    fixtureOverrides({ files: ["src/**/*.integration.test.ts"], fixtureName: "integrationTest" }),
    fixtureOverrides({ files: ["src/**/*.concurrency.test.ts"], fixtureName: "concurrencyTest" }),
  ],
} satisfies OxlintConfig)

/**
 * Some vitest rules don't understand fixtures and won't apply.
 *
 * See:
 * - https://github.com/oxc-project/oxc/issues/22323
 * - https://github.com/oxc-project/oxc/issues/26675
 */
function fixtureOverrides({ files, fixtureName }: { files: string[]; fixtureName: string }): OxlintOverride {
  const testCalls = [fixtureName, `${fixtureName}.for`]
  return {
    files,
    rules: {
      "vitest/require-hook": ["error", { allowedFunctionCalls: testCalls }],
      "vitest/no-standalone-expect": ["error", { additionalTestBlockFunctions: testCalls }],
      "vitest-fixtures/no-conditional-in-test": ["error", { fixtureName }],
    },
  }
}
