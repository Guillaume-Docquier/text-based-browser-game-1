import { defineConfig, type OxlintConfig, type OxlintOverride } from "oxlint"
import baseConfig from "../../oxlint.config.ts"

const noRollbackError = {
  group: ["**/TransactionRollbackError", "**/TransactionRollbackError.*"],
  message: "TransactionRollbackError can only be used in *.error.ts files. Use a specific rollback error instead.",
}
const noIntegrationDb = {
  group: ["**/createIntegrationTestDb", "**/createIntegrationTestDb.*"],
  message: "Use createIntegrationTestDb only in *.integration.test.ts files.",
}
const noConcurrencyDb = {
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
    noRestrictedImports({ files: ["**/*"], patterns: [noIntegrationDb, noConcurrencyDb] }),
    noRestrictedImports({
      files: ["**/*.ts"],
      excludeFiles: ["**/*.error.ts"],
      patterns: [noRollbackError, noIntegrationDb, noConcurrencyDb],
    }),
    noRestrictedImports({ files: ["src/**/*.integration.test.ts"], patterns: [noRollbackError, noConcurrencyDb] }),
    noRestrictedImports({ files: ["src/**/*.concurrency.test.ts"], patterns: [noRollbackError, noIntegrationDb] }),
    noRestrictedImports({
      files: ["src/tests/vitest.integration.setup.ts"],
      patterns: [noRollbackError, noConcurrencyDb, { ...noIntegrationDb, allowImportNames: ["prepareIntegrationTestDb"] }],
    }),
    noRestrictedImports({
      files: ["src/tests/vitest.concurrency.setup.ts"],
      patterns: [noRollbackError, noIntegrationDb, { ...noConcurrencyDb, allowImportNames: ["prepareConcurrencyTestDb"] }],
    }),
    {
      files: ["src/api/**/*.router*.ts"],
      rules: {
        "typescript/no-confusing-void-expression": "off",
      },
    },
    {
      files: ["src/**/*.test-d.ts"],
      rules: {
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

type RestrictedImportPattern = {
  group: string[]
  message: string
  allowImportNames?: string[]
}

function noRestrictedImports({
  patterns,
  ...scope
}: Pick<OxlintOverride, "files" | "excludeFiles"> & { patterns: RestrictedImportPattern[] }): OxlintOverride {
  return {
    ...scope,
    rules: { "no-restricted-imports": ["error", { patterns }] },
  }
}
