import { defineConfig } from "vitest/config"

const integrationTestsInclude = ["src/**/*.router.test.ts", "src/**/TickProcessor.test.ts"]
const loadTestsInclude = ["src/**/*.load.test.ts"]

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
    slowTestThreshold: 600,
    projects: [
      {
        // unit tests are lightweight and fast
        extends: true,
        test: {
          name: { label: "unit", color: "green" },
          include: ["src/**/*.test.ts"],
          // I would do something like .unit.test.ts and .integration.test.ts without exclude
          // However, this breaks WebStorm's "Go to test" and it cannot be configured...
          exclude: [...integrationTestsInclude, ...loadTestsInclude],
        },
      },
      {
        // load tests use a containerized real postgres
        extends: true,
        test: {
          name: { label: "load", color: "yellow" },
          include: loadTestsInclude,
          testTimeout: 60_000,
        },
      },
      {
        // integration tests use in-memory db
        extends: true,
        test: {
          name: { label: "integration", color: "cyan" },
          include: integrationTestsInclude,
          setupFiles: ["./src/tests/vitest.e2e.setup.ts"],
        },
      },
    ],
  },
})
