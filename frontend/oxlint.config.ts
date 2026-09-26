import { react } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"
import baseConfig from "../oxlint.config.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  overrides: [
    {
      ...react,
      files: ["**/*.{ts,tsx}"],
      excludeFiles: ["playwright/**/*"],
    },
  ],
} satisfies OxlintConfig)
