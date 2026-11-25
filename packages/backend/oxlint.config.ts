import { defineConfig, type OxlintConfig, type OxlintOverride } from "oxlint"
import { WorkspaceBoundaries } from "../../linting/boundaries.ts"
import baseConfig from "../../oxlint.config.ts"

const [, workspaceDependencies] = WorkspaceBoundaries.rules["boundaries/dependencies"]

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
  settings: baseConfig.settings,
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        ...workspaceDependencies,
        policies: [
          ...workspaceDependencies.policies,
          {
            from: { file: { path: "packages/backend/src/api/entry.api.ts" } },
            disallow: { to: { file: { path: "packages/backend/src/**/*{.useCase,UseCase}.ts" } } },
            message: "Create use cases in createApi.ts. Keep use-case types and values out of entry.api.ts.",
          },
          {
            from: { file: { path: "packages/backend/src/api/createApi.ts" } },
            disallow: {
              to: { file: { path: "packages/backend/src/**/*{.repository,Repository}.ts" } },
              dependency: { kind: "value" },
            },
            message: "Create repositories in entry.api.ts and import only their types in createApi.ts.",
          },
        ],
      },
    ],
  },
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
      files: ["src/testing/vitest.integration.setup.ts"],
      patterns: [noRollbackError, noConcurrencyDb, { ...noIntegrationDb, allowImportNames: ["prepareIntegrationTestDb"] }],
    }),
    noRestrictedImports({
      files: ["src/testing/vitest.concurrency.setup.ts"],
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
        // INTENT: Rejected type expressions are asserted with @ts-expect-error, without an expectation call.
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
