import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/tests/vitest.setup.ts"],
  },
})
