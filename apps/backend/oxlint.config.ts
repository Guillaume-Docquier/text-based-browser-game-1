import { defineConfig, type OxlintConfig } from "oxlint"
import baseConfig from "../../oxlint.config.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  env: {
    node: true,
  },
  plugins: ["vitest"],
  overrides: [
    {
      files: ["src/**/*.ts"],
      excludeFiles: ["src/**/*.test.ts"],
      rules: {
        "no-restricted-globals": ["error", { name: "Date", message: "Use an injected clock instead." }],
      },
    },
    {
      files: ["src/**/*.integration.test.ts"],
      rules: {
        // Fixture support
        "vitest/require-hook": ["error", { allowedFunctionCalls: ["integrationTest", "integrationTest.for"] }],
        "vitest/no-standalone-expect": ["error", { additionalTestBlockFunctions: ["integrationTest", "integrationTest.for"] }],
      },
    },
  ],
} satisfies OxlintConfig)
