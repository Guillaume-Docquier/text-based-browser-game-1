import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    {
      name: "inherit-vitest-watch-mode",
      configureVitest({ vitest, project }): void {
        // Vitest can default projects to watch mode during `vitest run` in interactive terminals.
        // Keep the typechecker from spawning a watcher that outlives the test run on Windows.
        // Remove when https://github.com/vitest-dev/vitest/issues/9494 is fixed upstream.
        project.config.watch = vitest.config.watch
      },
    },
  ],
  test: {
    coverage: {
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test-d.ts",
        "src/**/*.d.ts",
        "src/tests/**",
        "**entry.*.ts",
        "src/lib/parseEnv.ts",
        "src/lib/db/createDb.ts",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", ["lcov", { projectRoot: fileURLToPath(new URL("../..", import.meta.url)) }]],
      reportsDirectory: "./coverage",
    },
    environment: "node",
    globals: false,
    slowTestThreshold: 1_000, // Tailored for local
    projects: [
      {
        // type tests are statically analyzed and included in normal backend test runs
        test: {
          name: { label: "types", color: "blue" },
          typecheck: {
            enabled: true,
            only: true,
            include: ["**/*.test-d.ts"],
          },
        },
      },
      {
        // unit tests are lightweight and fast
        test: {
          name: { label: "unit", color: "green" },
          include: ["**/*.unit.test.ts"],
        },
      },
      {
        // integration tests use in-memory db
        test: {
          name: { label: "integration", color: "cyan" },
          include: ["**/*.integration.test.ts"],
          setupFiles: ["./src/tests/vitest.integration.setup.ts"],
          testTimeout: 15_000, // slow in CI
        },
      },
      {
        // concurrency tests use a real postgres database via testcontainers
        test: {
          name: { label: "concurrency", color: "magenta" },
          include: ["**/*.concurrency.test.ts"],
          setupFiles: ["./src/tests/vitest.concurrency.setup.ts"],
          testTimeout: 30_000, // slow in CI
        },
      },
    ],
  },
})
