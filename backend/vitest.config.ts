import { defineConfig } from "vitest/config"

const integrationTestsInclude = ["src/**/*.router.test.ts", "src/**/TurnProcessor.test.ts"]
const concurrencyTestsInclude = ["src/**/*.concurrency.test.ts"]
const unitTestsInclude = ["src/**/*.test.ts", "scripts/**/*.test.ts"]

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/**/*.test.ts", "src/tests/**", "**entry.*.ts", "src/lib/parseEnv.ts", "src/lib/db/createDb.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
    environment: "node",
    globals: false,
    slowTestThreshold: 1_000, // Tailored for local
    projects: [
      {
        // unit tests are lightweight and fast
        extends: true,
        test: {
          name: { label: "unit", color: "green" },
          include: unitTestsInclude,
          // I would do something like .unit.test.ts and .integration.test.ts without exclude
          // However, this breaks WebStorm's "Go to test" and it cannot be configured...
          exclude: [...integrationTestsInclude, ...concurrencyTestsInclude],
        },
      },
      {
        // integration tests use in-memory db
        extends: true,
        test: {
          name: { label: "integration", color: "cyan" },
          include: integrationTestsInclude,
          setupFiles: ["./src/tests/vitest.integration.setup.ts"],
          testTimeout: 7_000, // slow in CI
        },
      },
      {
        // concurrency tests use a real postgres database via testcontainers
        extends: true,
        test: {
          name: { label: "concurrency", color: "magenta" },
          include: concurrencyTestsInclude,
          setupFiles: ["./src/tests/vitest.concurrency.setup.ts"],
          testTimeout: 30_000, // slow in CI
        },
      },
    ],
  },
})
