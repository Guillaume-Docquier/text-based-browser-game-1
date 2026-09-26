import { defineConfig, type OxlintConfig } from "oxlint"
import baseConfig from "../oxlint.config.ts"
import { Boundaries } from "./boundaries.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  env: {
    node: true,
  },
  jsPlugins: ["eslint-plugin-boundaries"],
  settings: Boundaries.settings,
  rules: Boundaries.rules,
  overrides: [
    {
      files: ["src/**/*.ts"],
      excludeFiles: ["src/**/*.test.ts"],
      rules: {
        "no-restricted-globals": ["error", { name: "Date", message: "Use an injected clock instead." }],
      },
    },
    {
      files: ["scripts/**/*"],
      rules: {
        "no-console": "off",
      },
    },
  ],
} satisfies OxlintConfig)
