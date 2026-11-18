import { defineConfig, type OxlintConfig, type OxlintOverride } from "oxlint"
import baseConfig from "../../oxlint.config.ts"

const rollbackError = {
  group: ["**/TransactionRollbackError", "**/TransactionRollbackError.*"],
  message: "TransactionRollbackError can only be used in *.error.ts files. Use a specific rollback error instead.",
}
const integrationDb = {
  group: ["**/createIntegrationTestDb", "**/createIntegrationTestDb.*"],
  message: "Use createIntegrationTestDb only in *.integration.test.ts files.",
}
const concurrencyDb = {
  group: ["**/createConcurrencyTestDb", "**/createConcurrencyTestDb.*"],
  message: "Use createConcurrencyTestDb only in *.concurrency.test.ts files.",
}

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  env: {
    node: true,
  },
  plugins: ["vitest"],
  overrides: [
    // Each matching override replaces the full no-restricted-imports rule.
    ...[
      { files: ["**/*"], patterns: [integrationDb, concurrencyDb] },
      { files: ["**/*.ts"], excludeFiles: ["**/*.error.ts"], patterns: [rollbackError, integrationDb, concurrencyDb] },
      { files: ["src/**/*.integration.test.ts"], patterns: [rollbackError, concurrencyDb] },
      { files: ["src/**/*.concurrency.test.ts"], patterns: [rollbackError, integrationDb] },
      {
        files: ["src/tests/vitest.integration.setup.ts"],
        patterns: [rollbackError, concurrencyDb, { ...integrationDb, allowImportNames: ["prepareIntegrationTestDb"] }],
      },
      {
        files: ["src/tests/vitest.concurrency.setup.ts"],
        patterns: [rollbackError, integrationDb, { ...concurrencyDb, allowImportNames: ["prepareConcurrencyTestDb"] }],
      },
    ].map(({ patterns, ...scope }): OxlintOverride => ({ ...scope, rules: { "no-restricted-imports": ["error", { patterns }] } })),
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
  ],
} satisfies OxlintConfig)
