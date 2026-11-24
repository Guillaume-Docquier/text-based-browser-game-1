import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test-d.ts",
        "src/**/*.d.ts",
        "src/testing/**",
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
    isolate: false,
    globals: false,
    slowTestThreshold: 1_000,
    projects: [
      {
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
        test: {
          name: { label: "integration", color: "cyan" },
          include: ["**/*.integration.test.ts"],
          setupFiles: ["./src/testing/vitest.integration.setup.ts"],
          testTimeout: 15_000,
        },
      },
      {
        test: {
          name: { label: "concurrency", color: "magenta" },
          include: ["**/*.concurrency.test.ts"],
          setupFiles: ["./src/testing/vitest.concurrency.setup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
})
