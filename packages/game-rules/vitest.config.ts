import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", ["lcov", { projectRoot: fileURLToPath(new URL("../..", import.meta.url)) }]],
      reportsDirectory: "./coverage",
    },
    environment: "node",
    globals: false,
    slowTestThreshold: 15, // Tailored for local
  },
})
