import { defineConfig, type OxlintConfig } from "oxlint"
import baseConfig from "../../oxlint.config.ts"
import { Boundaries } from "./boundaries.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  settings: Boundaries.settings,
  rules: Boundaries.rules,
} satisfies OxlintConfig)
