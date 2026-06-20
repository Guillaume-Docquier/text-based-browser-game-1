import { defineConfig } from "vitest/config"

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
    // I would do something like .unit.test.ts and .e2e.test.ts
    // However, this breaks WebStorm's "Go to test" and it cannot be configured...
    projects: [
      {
        extends: true,
        test: {
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.router.test.ts", "src/**/processTick.test.ts"],
          name: "unit",
        },
      },
      {
        extends: true,
        test: {
          include: ["src/**/*.router.test.ts", "src/**/processTick.test.ts"],
          name: "e2e",
          setupFiles: ["./src/tests/vitest.e2e.setup.ts"],
        },
      },
    ],
  },
})
