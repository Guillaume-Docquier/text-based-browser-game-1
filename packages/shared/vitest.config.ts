import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defaultExclude, defineConfig } from "vitest/config"

const moduleDirectories = readdirSync(new URL("./src/", import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory())

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["**/.stryker/**"],
      provider: "v8",
      reporter: ["text", ["lcov", { projectRoot: fileURLToPath(new URL("../..", import.meta.url)) }]],
      reportsDirectory: "./coverage",
    },
    environment: "node",
    exclude: [...defaultExclude, "**/.stryker/**"],
    globals: false,
    projects: moduleDirectories.map(({ name }) => ({
      extends: true as const,
      test: { name, dir: `src/${name}` },
    })),
    slowTestThreshold: 15,
  },
})
