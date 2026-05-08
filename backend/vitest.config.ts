import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/**/*.test.ts", "src/tests/**"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/tests/vitest.setup.ts"],
  },
})
