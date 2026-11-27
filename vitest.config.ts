import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      { test: { name: "linting", include: ["linting/**/*.test.ts"] } },
      { test: { name: "scripts", include: ["scripts/**/*.test.ts"] } },
    ],
  },
})
